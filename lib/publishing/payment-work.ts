import { db, currentWork, type Order, type Project } from "./db"
import { fulfillOrder, submitPrintRequest } from "./fulfill"
import { createHash } from "node:crypto"
import { assertPaymentEnvironment, getPaymentProvider, PaymentError } from "./payment"
import { cancelOrder, getOrder, SweetBookError } from "./sweetbook"

async function cancelRefundedOrder(order: Order) {
  if (!order.print_order_uid && order.print_request) {
    await submitPrintRequest(order, order.print_request)
    order = await currentWork(order)
  }
  if (!order.print_order_uid) return "not_started"
  const print = await getOrder(order.print_order_uid)
  if (["CANCELLED", "CANCELLED_REFUND"].includes(print.orderStatus)) return "cancelled"
  if (!["PAID", "PDF_READY"].includes(print.orderStatus)) return "needs_review"
  await cancelOrder(order.print_order_uid, "Customer payment fully refunded")
  // Verify after cancellation, including a previously lost response.
  const confirmed = await getOrder(order.print_order_uid)
  if (!["CANCELLED", "CANCELLED_REFUND"].includes(confirmed.orderStatus)) throw new Error("Cancellation not confirmed")
  return "cancelled"
}

async function syncPayment(order: Order) {
  const payment = await getPaymentProvider().getOrderEvent(order.payment_order_id!, order.id)
  const { error } = await db().rpc("publishing_record_payment", {
    p_event_id: `reconcile-${createHash("sha256").update(JSON.stringify(payment)).digest("hex")}`, p_event: payment,
  })
  if (error) throw new PaymentError(409, "결제 내역 대조 실패")
}

/** Round-robin check for lost callbacks after successful fulfillment, including later refunds. */
export async function reconcileSubmittedOrder(): Promise<boolean> {
  const { data: order, error } = await db().from("publishing_orders").select("*")
    .eq("status", "submitted").eq("review_required", false).eq("kind", "physical").not("print_order_uid", "is", null)
    .order("updated_at", { ascending: true }).limit(1).maybeSingle<Order>()
  if (error) throw new Error("Submitted order lookup failed")
  if (!order) return false
  await syncPayment(order)
  const current = await getOrder(order.print_order_uid!)
  if (current.orderUid !== order.print_order_uid) throw new Error("Supplier identity mismatch")
  const { error: eventError } = await db().rpc("publishing_record_print_event", {
    p_event_id: `reconcile-${order.print_order_uid}-${current.orderStatus}`,
    p_event_name: "reconciliation", p_print_uid: order.print_order_uid, p_status: current.orderStatus,
  })
  if (eventError) throw new Error("Supplier snapshot recording failed")
  const { error: touchError } = await db().from("publishing_orders")
    .update({ updated_at: new Date().toISOString() }).eq("id", order.id)
  if (touchError) throw new Error("Reconciliation recording failed")
  await runPaymentWork(order.id)
  return true
}

/** Durable order queue plus an atomic lease; after() is only a fast-path wakeup. */
export async function runPaymentWork(orderId?: string): Promise<boolean> {
  const { data, error } = await db().rpc("publishing_claim_work", { p_order_id: orderId ?? null })
  if (error) throw new Error(`Work claim failed: ${error.message}`)
  let order = (data as Order[] | null)?.[0]
  if (!order) return false
  const token = order.fulfillment_token!
  try {
    assertPaymentEnvironment(order.payment_test_mode === true)
    // Reconcile the provider's current state before any printing, including a missing refund webhook.
    await syncPayment(order)
    order = await currentWork(order)
    if (order.status !== "refunded" && !order.review_required) {
      const { data: project, error: projectError } = await db().from("publishing_projects")
        .select("*").eq("id", order.project_id).single<Project>()
      if (projectError || !project) throw new Error("Project lookup failed")
      await fulfillOrder(order, project)
    }
    order = await currentWork(order)
    const cancellation = order.status === "refunded" ? await cancelRefundedOrder(order) : null
    const { error: finishError } = await db().from("publishing_orders").update({
      fulfillment_token: null, fulfillment_until: null, next_retry_at: null,
      ...(cancellation ? { cancellation_status: cancellation, review_required: cancellation === "needs_review" } : {}),
    }).eq("id", order.id).eq("fulfillment_token", token)
    if (finishError) throw new Error(`Work completion failed: ${finishError.message}`)
    return true
  } catch (e) {
    const message = e instanceof Error ? e.message : "Fulfillment failed"
    // Keep full refunds terminal. Temporary failures get five bounded retries; permanent errors need an operator.
    const permanent = (e instanceof PaymentError && [400,401,403,404,409,503].includes(e.status))
      || (e instanceof SweetBookError && [400,401,403,404,402,422].includes(e.status))
      || order.fulfillment_attempts >= 5
    const next = new Date(Date.now() + Math.min(60 * 60, 60 * 2 ** order.fulfillment_attempts) * 1000).toISOString()
    const { error: failureError } = await db().rpc("publishing_fail_work", {
      p_order_id: order.id, p_token: token, p_reason: message,
      p_permanent: permanent, p_retry_at: permanent ? null : next,
    })
    if (failureError) throw new Error(`Failure recording failed: ${failureError.message}`)
    console.error("[publish/work]", order.id, permanent ? "needs_review" : "retry_scheduled")
    return false
  }
}
