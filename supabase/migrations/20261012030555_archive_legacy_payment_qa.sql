-- Verified QA records retain their historical money/print state without entering live work.
alter table public.publishing_orders
  add column archived_at timestamptz,
  add constraint publishing_archive_test_only check (archived_at is null or (payment_test_mode is true and fulfillment_token is null and checkout_lease_token is null));

create or replace function public.publishing_record_payment(p_event_id text, p_event jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  o public.publishing_orders;
  ref uuid := (p_event->>'reference')::uuid;
  total bigint := (p_event->>'totalMinor')::bigint;
  refund bigint := (p_event->>'refundedMinor')::bigint;
  is_test boolean := (p_event->>'testMode')::boolean;
  mismatch boolean;
  refund_tolerance bigint;
  full_refund boolean := coalesce((p_event->>'fullyRefunded')::boolean, false) or refund = total;
begin
  select * into strict o from public.publishing_orders where id = ref for update;
  -- An archived QA fixture is never a live payment destination.
  if o.archived_at is not null then
    if is_test is distinct from true then raise exception 'Live payment targeted an archived QA order'; end if;
    return ref;
  end if;
  refund_tolerance := case when o.payment_currency = 'KRW' then 100 else 0 end;
  if o.expected_store_id is null or o.expected_variant_id is null or o.payment_test_mode is null
    or o.expected_store_id <> p_event->>'storeId'
    or o.expected_variant_id <> p_event->>'variantId'
    or o.payment_test_mode <> is_test
    or p_event->>'currency' is distinct from o.payment_currency
    or (o.payment_currency = 'USD' and o.expected_total_minor is null)
    or total <= 0 or refund < 0
    or (refund > total and not (full_refund and abs(refund - total) <= refund_tolerance))
    or (coalesce((p_event->>'fullyRefunded')::boolean, false) and abs(refund - total) > refund_tolerance)
    or (o.payment_provider is not null and o.payment_provider <> 'lemonsqueezy')
    or (o.payment_order_id = p_event->>'providerOrderId' and o.charged_total_minor is not null and o.charged_total_minor <> total)
  then raise exception 'Payment identity or currency mismatch'; end if;

  mismatch := case when o.payment_currency = 'USD' then total <> o.expected_total_minor
    else total > o.price_krw::bigint * 100 or total < (o.price_krw - 500)::bigint * 100 end;

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
        status = case when full_refund then 'refunded' else 'failed' end,
        review_required = not full_refund,
        failure_reason = case when not full_refund then 'Partial refund requires review' else null end,
        cancellation_status = case when full_refund then 'pending' else cancellation_status end,
        next_retry_at = now()
        where id = ref;
    end if;
  elsif p_event->>'type' = 'paid' and o.status not in ('submitted', 'refunded', 'cancelled')
    and o.refunded_total_minor = 0 and o.payment_order_id is null then
    update public.publishing_orders set
      status = case when mismatch then 'failed' else 'paid' end,
      review_required = mismatch,
      failure_reason = case when mismatch then 'Charged amount requires review/refund' else null end,
      next_retry_at = now() where id = ref;
  elsif p_event->>'type' = 'paid' and o.status = 'cancelled' then
    update public.publishing_orders set review_required = true, failure_reason = 'Payment received after checkout expiration' where id = ref;
  end if;
  update public.publishing_webhook_events set processed_at = now(), error = null
    where provider = 'lemonsqueezy' and event_id = p_event_id;
  return ref;
end $$;

create or replace function public.publishing_claim_work(p_order_id uuid default null)
returns setof public.publishing_orders language plpgsql security invoker set search_path = '' as $$
declare ref uuid;
begin
  select id into ref from public.publishing_orders
    where archived_at is null and (p_order_id is null or id = p_order_id)
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
