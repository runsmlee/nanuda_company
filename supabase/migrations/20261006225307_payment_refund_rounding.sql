-- Confirmed full refunds may differ by up to KRW 1 after USD conversion. Preserve the reported amount.
create or replace function public.publishing_record_payment(p_event_id text, p_event jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  o public.publishing_orders;
  ref uuid := (p_event->>'reference')::uuid;
  total bigint := (p_event->>'totalMinor')::bigint;
  refund bigint := (p_event->>'refundedMinor')::bigint;
  is_test boolean := (p_event->>'testMode')::boolean;
  full_refund boolean := coalesce((p_event->>'fullyRefunded')::boolean, false) or refund = total;
begin
  select * into strict o from public.publishing_orders where id = ref for update;
  if o.expected_store_id is null or o.expected_variant_id is null or o.payment_test_mode is null
    or o.expected_store_id <> p_event->>'storeId'
    or o.expected_variant_id <> p_event->>'variantId'
    or o.payment_test_mode <> is_test
    or p_event->>'currency' <> 'KRW'
    or total <= 0 or refund < 0
    or (refund > total and not (full_refund and abs(refund - total) <= 100))
    or (coalesce((p_event->>'fullyRefunded')::boolean, false) and abs(refund - total) > 100)
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
