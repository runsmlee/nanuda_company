-- Additive migration. Existing orders are never automatically reprinted.
alter table public.publishing_projects add column request_hash text;
alter table public.publishing_orders
  add column request_hash text,
  add column book_uid text,
  add column print_requested_at timestamptz,
  add column print_request jsonb,
  add column checkout_url text,
  add column checkout_id text,
  add column checkout_expires_at timestamptz,
  add column checkout_lease_until timestamptz,
  add column checkout_lease_token uuid,
  add column expected_store_id text,
  add column expected_variant_id text,
  add column payment_test_mode boolean,
  add column charged_total_minor bigint,
  add column refunded_total_minor bigint not null default 0,
  add column review_required boolean not null default false,
  add column cancellation_status text,
  add column fulfillment_token uuid,
  add column fulfillment_until timestamptz,
  add column fulfillment_attempts integer not null default 0,
  add column next_retry_at timestamptz;

-- Persist and acknowledge a payment together. A failed write rolls back the ledger too.
create or replace function public.publishing_record_payment(p_event_id text, p_event jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  o public.publishing_orders;
  ref uuid := (p_event->>'reference')::uuid;
  total bigint := (p_event->>'totalMinor')::bigint;
  refund bigint := (p_event->>'refundedMinor')::bigint;
  is_test boolean := (p_event->>'testMode')::boolean;
begin
  select * into strict o from public.publishing_orders where id = ref for update;
  if o.expected_store_id is null or o.expected_variant_id is null or o.payment_test_mode is null
    or o.expected_store_id <> p_event->>'storeId'
    or o.expected_variant_id <> p_event->>'variantId'
    or o.payment_test_mode <> is_test
    or p_event->>'currency' <> 'KRW'
    or total <= 0 or refund < 0 or refund > total
    or (o.payment_provider is not null and o.payment_provider <> 'lemonsqueezy')
    or (o.payment_order_id = p_event->>'providerOrderId' and o.charged_total_minor is not null and o.charged_total_minor <> total)
  then raise exception 'Payment identity or currency mismatch'; end if;

  if exists(select 1 from public.publishing_webhook_events where provider = 'lemonsqueezy'
    and event_id = p_event_id and processed_at is not null) then return ref; end if;
  insert into public.publishing_webhook_events(provider, event_id, event_name)
    values ('lemonsqueezy', p_event_id, p_event->>'rawEventName') on conflict do nothing;

  if o.payment_order_id is not null and o.payment_order_id <> p_event->>'providerOrderId' then
    update public.publishing_orders set review_required = true,
      failure_reason = 'Unexpected additional payment/refund: reconcile customer balance' where id = ref;
    update public.publishing_webhook_events set processed_at = now(),
      error = 'Unmatched provider order ' || (p_event->>'providerOrderId') || ', total minor ' || total::text
      where provider = 'lemonsqueezy' and event_id = p_event_id;
    return ref;
  end if;
  begin
    update public.publishing_orders set payment_provider = 'lemonsqueezy',
      payment_order_id = p_event->>'providerOrderId', charged_total_minor = total,
      paid_at = coalesce(paid_at, now()) where id = ref;
  exception when unique_violation then
    update public.publishing_orders set review_required = true,
      failure_reason = 'Payment is already linked to a different order' where id = ref;
    update public.publishing_webhook_events set processed_at = now(),
      error = 'Payment ownership conflict ' || (p_event->>'providerOrderId')
      where provider = 'lemonsqueezy' and event_id = p_event_id;
    return ref;
  end;

  if p_event->>'type' = 'refunded' then
    if refund <= 0 then raise exception 'Missing refund amount'; end if;
    if refund > o.refunded_total_minor then
      update public.publishing_orders set refunded_total_minor = refund,
        status = case when refund = total then 'refunded' else 'failed' end,
        review_required = refund < total,
        failure_reason = case when refund < total then 'Partial refund requires review' else null end,
        cancellation_status = case when refund = total then 'pending' else cancellation_status end,
        next_retry_at = now()
        where id = ref;
    end if;
  elsif p_event->>'type' = 'paid' and o.status not in ('submitted', 'refunded', 'cancelled')
    and o.refunded_total_minor = 0 and o.payment_order_id is null then
    update public.publishing_orders set
      status = case when total > price_krw::bigint * 100 or total < (price_krw - 500)::bigint * 100 then 'failed' else 'paid' end,
      review_required = total > price_krw::bigint * 100 or total < (price_krw - 500)::bigint * 100,
      failure_reason = case when total > price_krw::bigint * 100 or total < (price_krw - 500)::bigint * 100 then 'Charged amount requires review/refund' else null end,
      next_retry_at = now() where id = ref;
  elsif p_event->>'type' = 'paid' and o.status = 'cancelled' then
    update public.publishing_orders set review_required = true, failure_reason = 'Payment received after checkout expiration' where id = ref;
  end if;
  update public.publishing_webhook_events set processed_at = now(), error = null
    where provider = 'lemonsqueezy' and event_id = p_event_id;
  return ref;
end $$;

-- One worker per order; crashed workers can be reclaimed. Supplier keys remain stable across leases.
create or replace function public.publishing_claim_work(p_order_id uuid default null)
returns setof public.publishing_orders language plpgsql security invoker set search_path = '' as $$
declare ref uuid;
begin
  select id into ref from public.publishing_orders
    where (p_order_id is null or id = p_order_id)
      and (fulfillment_until is null or fulfillment_until < now())
      and (next_retry_at is null or next_retry_at <= now())
      and ((status in ('paid','failed') and not review_required and print_order_uid is null
          and payment_order_id is not null and payment_test_mode is not null)
        or (status = 'refunded' and cancellation_status = 'pending' and not review_required))
    order by next_retry_at nulls first, created_at for update skip locked limit 1;
  if ref is null then return; end if;
  return query update public.publishing_orders set fulfillment_token = gen_random_uuid(),
    fulfillment_until = now() + interval '5 minutes', fulfillment_attempts = fulfillment_attempts + 1
    where id = ref returning *;
end $$;

-- The token prevents a slow/stale worker from submitting after its lease has been reclaimed.
create or replace function public.publishing_attach_print(p_order_id uuid, p_token uuid, p_print_uid text, p_status text)
returns setof public.publishing_orders language plpgsql security invoker set search_path = '' as $$
begin
  return query update public.publishing_orders set print_order_uid = p_print_uid, print_status = p_status,
    status = case when status in ('refunded','cancelled') or review_required then status else 'submitted' end,
    submitted_at = now(), failure_reason = case when review_required then failure_reason else null end
    where id = p_order_id and fulfillment_token = p_token
      and (print_order_uid is null or print_order_uid = p_print_uid) returning *;
end $$;

-- Failure recording must preserve a partial/full refund that arrived while the supplier call was failing.
create or replace function public.publishing_fail_work(p_order_id uuid, p_token uuid, p_reason text, p_permanent boolean, p_retry_at timestamptz)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update public.publishing_orders set
    status = case when status = 'refunded' or print_order_uid is not null then status else 'failed' end,
    failure_reason = left(p_reason, 500),
    review_required = review_required or p_permanent,
    fulfillment_token = null, fulfillment_until = null,
    next_retry_at = case when review_required or p_permanent then null else p_retry_at end
    where id = p_order_id and fulfillment_token = p_token;
  return found;
end $$;

-- Processed only after the state write succeeds; unmatched early callbacks stay retryable.
create or replace function public.publishing_record_print_event(p_event_id text, p_event_name text, p_print_uid text, p_status text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  if exists(select 1 from public.publishing_webhook_events where provider = 'sweetbook'
    and event_id = p_event_id and processed_at is not null) then return true; end if;
  perform 1 from public.publishing_orders where print_order_uid = p_print_uid for update;
  if not found then return false; end if;
  -- p_status comes from an authenticated supplier GET, rather than the callback snapshot.
  update public.publishing_orders set print_status = p_status
    where print_order_uid = p_print_uid and
      (print_status is null or p_status in ('CANCELLED','CANCELLED_REFUND','ERROR')
        or (print_status not in ('CANCELLED','CANCELLED_REFUND','DELIVERED') and
          coalesce(array_position(array['PAID','PDF_READY','CONFIRMED','IN_PRODUCTION','COMPLETED','PRODUCTION_COMPLETE','SHIPPED','DELIVERED'], p_status),0)
          >= coalesce(array_position(array['PAID','PDF_READY','CONFIRMED','IN_PRODUCTION','COMPLETED','PRODUCTION_COMPLETE','SHIPPED','DELIVERED'], print_status),0)));
  update public.publishing_orders set review_required = true, status = 'failed',
    failure_reason = 'Supplier stopped a paid order: check recovery or customer refund'
    where print_order_uid = p_print_uid and status <> 'refunded' and p_status in ('CANCELLED','CANCELLED_REFUND','ERROR');
  insert into public.publishing_webhook_events(provider, event_id, event_name, processed_at)
    values ('sweetbook', p_event_id, p_event_name, now())
    on conflict (provider, event_id) do update set processed_at = now(), error = null;
  update public.publishing_orders set next_retry_at = now()
    where print_order_uid = p_print_uid and status = 'refunded' and cancellation_status = 'pending';
  return true;
end $$;

revoke all on function public.publishing_record_payment(text,jsonb) from public, anon, authenticated;
revoke all on function public.publishing_claim_work(uuid) from public, anon, authenticated;
revoke all on function public.publishing_attach_print(uuid,uuid,text,text) from public, anon, authenticated;
revoke all on function public.publishing_record_print_event(text,text,text,text) from public, anon, authenticated;
grant execute on function public.publishing_record_payment(text,jsonb) to service_role;
grant execute on function public.publishing_claim_work(uuid) to service_role;
grant execute on function public.publishing_attach_print(uuid,uuid,text,text) to service_role;
grant execute on function public.publishing_record_print_event(text,text,text,text) to service_role;

revoke all on function public.publishing_fail_work(uuid,uuid,text,boolean,timestamptz) from public, anon, authenticated;
grant execute on function public.publishing_fail_work(uuid,uuid,text,boolean,timestamptz) to service_role;
