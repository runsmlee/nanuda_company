-- Manuscript/cover retention promised by /privacy: files leave storage once no order can still need them.
-- Order, payment and shipping rows stay (5-year e-commerce record retention); only creative content is purged.
alter table public.publishing_projects
  alter column manuscript_path drop not null,
  add column files_purged_at timestamptz,
  add constraint publishing_files_retained check (files_purged_at is not null or manuscript_path is not null),
  add constraint publishing_files_purged check (files_purged_at is null or back_text is null);

-- Observed (not supplier-reported) times: a late observation only lengthens retention.
alter table public.publishing_orders
  add column shipped_at timestamptz,
  add column delivered_at timestamptz;
update public.publishing_orders set shipped_at = updated_at where print_status in ('SHIPPED','DELIVERED');
update public.publishing_orders set delivered_at = updated_at where print_status = 'DELIVERED';

-- True only when this order can never print, reprint or be re-checked against its files again.
create or replace function public.publishing_order_files_releasable(o public.publishing_orders)
returns boolean language sql stable security invoker set search_path = '' as $$
  select o.archived_at is not null or (not o.review_required and (
    -- Unpaid: a day past checkout expiry, so a straggling payment webhook lands on a review hold instead.
    (o.status in ('pending','cancelled') and o.payment_order_id is null
      and coalesce(o.checkout_expires_at, o.created_at) < now() - interval '1 day')
    -- Fully refunded and the print order is confirmed cancelled or never existed.
    or (o.status = 'refunded' and o.cancellation_status in ('cancelled','not_started'))
    -- Delivered: three months for defect reprints; without a delivery event, assume two weeks in transit.
    or (o.status = 'submitted'
      and coalesce(o.delivered_at, o.shipped_at + interval '14 days') < now() - interval '3 months')))
$$;

-- Marks due projects (locking out reuse) and returns every marked project whose storage is not yet empty.
-- Marking before deletion means a storage failure is retried next run instead of orphaning files.
create or replace function public.publishing_claim_file_purge(p_limit integer)
returns table(id uuid, manuscript_path text, cover_image_path text)
language plpgsql security invoker set search_path = '' as $$
begin
  update public.publishing_projects p set files_purged_at = now(), back_text = null
    where p.id in (
      select c.id from public.publishing_projects c
        where c.files_purged_at is null
          -- An order-less project is a crashed checkout; its attempt may still retry for a day.
          and (exists(select 1 from public.publishing_orders o where o.project_id = c.id)
            or c.created_at < now() - interval '1 day')
          and not exists(select 1 from public.publishing_orders o where o.project_id = c.id
            and not public.publishing_order_files_releasable(o))
        order by c.created_at for update skip locked limit p_limit);
  return query select p.id, p.manuscript_path, p.cover_image_path from public.publishing_projects p
    where p.files_purged_at is not null and (p.manuscript_path is not null or p.cover_image_path is not null)
    order by p.files_purged_at limit p_limit;
end $$;

create or replace function public.publishing_record_print_event(p_event_id text, p_event_name text, p_print_uid text, p_status text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  if exists(select 1 from public.publishing_webhook_events where provider = 'sweetbook'
    and event_id = p_event_id and processed_at is not null) then return true; end if;
  perform 1 from public.publishing_orders where print_order_uid = p_print_uid for update;
  if not found then return false; end if;
  if exists(select 1 from public.publishing_orders where print_order_uid = p_print_uid and archived_at is not null) then return true; end if;
  -- p_status comes from an authenticated supplier GET, rather than the callback snapshot.
  update public.publishing_orders set print_status = p_status
    where print_order_uid = p_print_uid and
      (print_status is null or p_status in ('CANCELLED','CANCELLED_REFUND','ERROR')
        or (print_status not in ('CANCELLED','CANCELLED_REFUND','DELIVERED') and
          coalesce(array_position(array['PAID','PDF_READY','CONFIRMED','IN_PRODUCTION','COMPLETED','PRODUCTION_COMPLETE','SHIPPED','DELIVERED'], p_status),0)
          >= coalesce(array_position(array['PAID','PDF_READY','CONFIRMED','IN_PRODUCTION','COMPLETED','PRODUCTION_COMPLETE','SHIPPED','DELIVERED'], print_status),0)));
  update public.publishing_orders set shipped_at = coalesce(shipped_at, now()),
    delivered_at = case when print_status = 'DELIVERED' then coalesce(delivered_at, now()) else delivered_at end
    where print_order_uid = p_print_uid and print_status in ('SHIPPED','DELIVERED');
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

revoke all on function public.publishing_order_files_releasable(public.publishing_orders) from public, anon, authenticated;
revoke all on function public.publishing_claim_file_purge(integer) from public, anon, authenticated;
grant execute on function public.publishing_order_files_releasable(public.publishing_orders) to service_role;
grant execute on function public.publishing_claim_file_purge(integer) to service_role;
