import { timingSafeEqual } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/publishing/db"
import { runPaymentWork, reconcileSubmittedOrder } from "@/lib/publishing/payment-work"
import { assertPaymentEnvironment, getPaymentProvider, paymentTestMode, PaymentError } from "@/lib/publishing/payment"
import { listBookSpecs, assertSupplierEnvironment, SweetBookError } from "@/lib/publishing/sweetbook"
import { hasBookPricing } from "@/lib/publishing/pricing"
import { checkoutMonitor } from "@/lib/publishing/checkout-observation"
import { purgeExpiredFiles } from "@/lib/publishing/retention"

export const runtime = "nodejs"
export const maxDuration = 120
export async function POST(req: NextRequest) {
  const secret = process.env.PUBLISH_WORKER_SECRET
  if (!secret || secret.length < 32) return NextResponse.json({ error: "Worker unavailable" }, { status: 503 })
  const supplied = Buffer.from(req.headers.get("authorization") ?? "")
  const expected = Buffer.from(`Bearer ${secret}`)
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (req.nextUrl.searchParams.get("monitor") === "1") {
    try {
      const checkout = await checkoutMonitor()
      return NextResponse.json({ checkout }, { status: checkout.alert ? 409 : 200, headers: { "Cache-Control": "private, no-store" } })
    } catch {
      return NextResponse.json({ error: "Checkout monitoring unavailable" }, { status: 503 })
    }
  }
  if (req.nextUrl.searchParams.get("check") === "1") {
    const checks: Record<string, { ok: boolean; detail?: string }> = {}
    try { await getPaymentProvider().checkConfiguration(); checks.payment = { ok: true } }
    catch (e) { checks.payment = { ok: false, detail: e instanceof PaymentError ? e.detail : "Payment API unavailable" } }
    try { assertPaymentEnvironment(paymentTestMode()) }
    catch { checks.supplier = { ok: false, detail: "Supplier API endpoint does not match the payment environment" } }
    if (!checks.supplier) {
      try {
        await assertSupplierEnvironment(paymentTestMode())
        const specs = await listBookSpecs()
        if (!specs.length || specs.some(s => !hasBookPricing(s))) throw new Error("Supplier prices unavailable")
        checks.supplier = { ok: true }
      } catch (e) { checks.supplier = { ok: false, detail: e instanceof SweetBookError ? `Supplier API lookup failed (${e.status})` : "Supplier API or catalog unavailable" } }
    }
    try {
      const { error } = await db().from("publishing_orders").select("id,expected_store_id,archived_at").limit(1)
      const { error: retentionError } = await db().from("publishing_projects").select("id,files_purged_at").limit(1)
      checks.database = { ok: !error && !retentionError }
    } catch { checks.database = { ok: false } }
    try { await checkoutMonitor(); checks.checkoutMonitoring = { ok: true } }
    catch { checks.checkoutMonitoring = { ok: false } }
    const ready = Object.values(checks).every(c => c.ok)
    return NextResponse.json({ ready, testMode: paymentTestMode(), checks }, { status: ready ? 200 : 503, headers: { "Cache-Control": "private, no-store" } })
  }
  try {
    const { error: expireError } = await db().from("publishing_orders").update({ status: "cancelled" })
      .eq("status", "pending").is("archived_at", null).is("payment_order_id", null).lt("checkout_expires_at", new Date().toISOString())
    if (expireError) throw expireError
    const processed = await runPaymentWork() || await reconcileSubmittedOrder()
    const purgedFiles = await purgeExpiredFiles()
    const { data: exceptions, count, error } = await db().from("publishing_orders").select("id, failure_reason, cancellation_status", { count: "exact" })
      .eq("review_required", true).is("archived_at", null)
    if (error) throw error
    const checkout = await checkoutMonitor()
    // A failed scheduled run is an operational alert; do not hide monetary exceptions behind 200.
    return NextResponse.json({ processed, purgedFiles, reviewRequired: count, exceptions, checkout }, { status: count || checkout.alert ? 409 : 200,
      headers: { "Cache-Control": "private, no-store" } })
  } catch {
    return NextResponse.json({ error: "Reconciliation failed" }, { status: 500 })
  }
}
