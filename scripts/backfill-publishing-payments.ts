// One-time legacy reconciliation. Default is read-only; apply only after migration 0002.
import { db, type Order } from "../lib/publishing/db"
import { getPaymentProvider } from "../lib/publishing/payment"
import { chargeMatches } from "../lib/publishing/webhook-guard"

async function main() {
const apply = process.argv.includes("--apply")
const { data: orders, error } = await db().from("publishing_orders").select("*")
if (error) throw new Error("Legacy order lookup failed")
const provider = getPaymentProvider()
let checked = 0, review = 0, failed = 0
for (const order of (orders ?? []) as Order[]) {
  if (order.payment_test_mode != null) continue
  if (!order.payment_order_id) {
    if (order.status !== "refunded") continue
    review++
    if (apply) {
      const { error } = await db().from("publishing_orders").update({
        review_required: true, failure_reason: "Legacy refund has no payment reference: reconcile manually",
      }).eq("id", order.id)
      if (error) throw new Error("Legacy exception recording failed")
    }
    continue
  }
  try {
    if (order.payment_provider !== provider.name) throw new Error("Unknown provider")
    const payment = await provider.getOrderEvent(order.payment_order_id, order.id)
    if (!payment.storeId || !payment.variantId || payment.currency !== "KRW"
      || !Number.isSafeInteger(payment.totalMinor) || !Number.isSafeInteger(payment.refundedMinor)
      || payment.refundedMinor < 0 || (payment.refundedMinor > payment.totalMinor
        && !(payment.fullyRefunded && Math.abs(payment.refundedMinor - payment.totalMinor) <= 100))) throw new Error("Invalid payment snapshot")
    const refunded = payment.refundedMinor === payment.totalMinor
      || (payment.fullyRefunded && Math.abs(payment.refundedMinor - payment.totalMinor) <= 100)
    const needsReview = !chargeMatches(payment.totalMinor, order.price_krw)
      || (payment.refundedMinor > 0 && !refunded) || (!refunded && !order.print_order_uid)
    if (needsReview) review++
    checked++
    if (apply) {
      const { error } = await db().from("publishing_orders").update({
        expected_store_id: payment.storeId, expected_variant_id: payment.variantId,
        payment_test_mode: payment.testMode, charged_total_minor: payment.totalMinor,
        refunded_total_minor: payment.refundedMinor, review_required: needsReview,
        ...(needsReview ? { failure_reason: "Legacy charge, refund or missing print submission requires review" } : {}),
        ...(refunded ? { status: "refunded", cancellation_status: "pending", next_retry_at: new Date().toISOString() } : {}),
      }).eq("id", order.id).is("payment_test_mode", null).select("id").single()
      if (error) throw new Error("Legacy payment recording failed")
    }
  } catch {
    failed++; review++
    if (apply) {
      const { error } = await db().from("publishing_orders").update({
        review_required: true, failure_reason: "Legacy payment snapshot unavailable: reconcile manually",
      }).eq("id", order.id)
      if (error) throw new Error("Legacy exception recording failed")
    }
  }
}
console.log(JSON.stringify({ mode: apply ? "apply" : "read-only", checked, reviewRequired: review, failed }))
if (failed) process.exitCode = 1

}
main().catch(() => { console.error("Legacy reconciliation failed"); process.exitCode = 1 })
