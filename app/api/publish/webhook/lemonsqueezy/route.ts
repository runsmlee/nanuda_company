import { createHash } from "node:crypto"
import { NextRequest, NextResponse, after } from "next/server"
import { db } from "@/lib/publishing/db"
import { getPaymentProvider } from "@/lib/publishing/payment"
import { runPaymentWork } from "@/lib/publishing/payment-work"

export const runtime = "nodejs"
export const maxDuration = 120

export async function POST(req: NextRequest) {
  let provider
  try { provider = getPaymentProvider() } catch {
    return NextResponse.json({ error: "결제 설정이 없습니다." }, { status: 503 })
  }
  const raw = await req.text()
  if (raw.length > 1_000_000) return NextResponse.json({ error: "이벤트가 너무 큽니다." }, { status: 413 })
  if (!provider.verifyWebhook(raw, req.headers.get("X-Signature"))) {
    return NextResponse.json({ error: "서명이 올바르지 않습니다." }, { status: 401 })
  }
  let event
  try {
    event = provider.parseEvent(raw, req.headers.get("X-Event-Name"))
    if (!event.providerOrderId) throw new Error("Missing provider order")
  } catch {
    return NextResponse.json({ error: "이벤트 형식이 올바르지 않습니다." }, { status: 400 })
  }
  if (event.type === "other") return NextResponse.json({ ok: true, ignored: true })
  // Store webhooks include other products. Only a known Nanuda order can route a legacy variant here.
  const foreignProduct = event.storeId !== process.env.LEMONSQUEEZY_STORE_ID || event.variantId !== process.env.LEMONSQUEEZY_VARIANT_ID
  if (foreignProduct) {
    if (!event.reference || !/^[0-9a-f-]{36}$/i.test(event.reference))
      return NextResponse.json({ ok: true, ignored: true })
    const { data: own, error } = await db().from("publishing_orders").select("id").eq("id", event.reference).maybeSingle()
    if (error) return NextResponse.json({ error: "주문 조회를 다시 시도해주세요." }, { status: 503 })
    if (!own) return NextResponse.json({ ok: true, ignored: true })
  }
  try {
    if (!event.reference || !/^[0-9a-f-]{36}$/i.test(event.reference)
      || !event.storeId || !event.variantId || !Number.isSafeInteger(event.totalMinor)
      || !Number.isSafeInteger(event.refundedMinor)) throw new Error("Invalid payment")
  } catch {
    return NextResponse.json({ error: "이벤트 형식이 올바르지 않습니다." }, { status: 400 })
  }
  // A digest distinguishes successive partial refunds without persisting a customer payload.
  const eventId = createHash("sha256").update(raw).digest("hex")
  const { error } = await db().rpc("publishing_record_payment", { p_event_id: eventId, p_event: event })
  if (error) {
    console.error("[publish/webhook] payment recording rejected", error.code)
    return NextResponse.json({ error: "결제 기록을 확인하지 못했습니다." }, { status: 500 })
  }
  // A 200 is safe now: payment + queue are committed. The scheduled worker recovers lost after() invocations.
  after(async () => { await runPaymentWork(event.reference!).catch(() => console.error("[publish/work] wakeup failed")) })
  return NextResponse.json({ ok: true })
}
