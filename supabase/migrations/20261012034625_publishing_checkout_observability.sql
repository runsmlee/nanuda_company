-- Independent of orders: survives failures before parsing, storage or order creation.
-- No email, IP, user agent, manuscript, address, URL, token or free-form error fields.
create table public.publishing_checkout_attempts (
  id uuid primary key,
  attempt_id uuid,
  order_id uuid,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  stage text not null check (stage in ('received','form','options','manuscript','email','shipping',
    'configuration','supplier','parse','typeset','cover','project','order','payment','quote')),
  outcome text not null default 'started' check (outcome in ('started','ready','rejected','failed')),
  http_status integer check (http_status between 200 and 599),
  duration_ms integer check (duration_ms >= 0),
  environment text not null check (environment in ('production','preview','development')),
  test_mode boolean not null,
  is_probe boolean not null default false,
  persistence_failed boolean not null default false,
  reviewed_at timestamptz,
  check ((outcome = 'started' and finished_at is null and http_status is null)
    or (outcome <> 'started' and finished_at is not null and http_status is not null))
);
alter table public.publishing_checkout_attempts enable row level security;
revoke all on public.publishing_checkout_attempts from public, anon, authenticated;
grant select, insert, update on public.publishing_checkout_attempts to service_role;
create index publishing_checkout_attempts_created on public.publishing_checkout_attempts(created_at desc);
create index publishing_checkout_attempts_attention on public.publishing_checkout_attempts(created_at)
  where environment = 'production' and not test_mode and not is_probe and reviewed_at is null;

-- Read-only report. IDs are diagnostics, not credentials. No customer fields are joined.
create function public.publishing_checkout_monitor() returns jsonb
language sql stable security invoker set search_path = '' as $$
  with live as (
    select * from public.publishing_checkout_attempts
    where environment = 'production' and not test_mode and not is_probe
  ), attention as (
    select * from live where reviewed_at is null and
      (outcome = 'failed' or persistence_failed or (outcome = 'started' and created_at < now() - interval '5 minutes'))
  ), counts as (
    select count(*) filter (where outcome = 'failed' or persistence_failed) as failures,
      count(*) filter (where outcome = 'started' and created_at < now() - interval '5 minutes') as stalled
    from attention
  ), recent as (
    select count(*) as rejected from live
    where outcome = 'rejected' and created_at > now() - interval '15 minutes'
  )
  select jsonb_build_object('alert', counts.failures > 0 or counts.stalled > 0 or recent.rejected >= 10,
    'unreviewedFailures', counts.failures, 'stalled', counts.stalled, 'recentRejected', recent.rejected,
    'last24Hours', (select jsonb_build_object('received', count(*),
      'ready', count(*) filter (where outcome = 'ready'), 'failed', count(*) filter (where outcome = 'failed'),
      'rejected', count(*) filter (where outcome = 'rejected')) from live where created_at > now() - interval '24 hours'),
    'exceptions', (select coalesce(jsonb_agg(jsonb_build_object('requestId', id, 'attemptId', attempt_id,
      'orderId', order_id, 'stage', stage, 'outcome', outcome, 'httpStatus', http_status,
      'createdAt', created_at, 'persistenceFailed', persistence_failed)), '[]'::jsonb)
      from (select * from attention order by created_at desc limit 20) a))
  from counts cross join recent;
$$;
revoke all on function public.publishing_checkout_monitor() from public, anon, authenticated;
grant execute on function public.publishing_checkout_monitor() to service_role;
