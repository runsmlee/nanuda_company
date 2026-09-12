import { NextRequest, NextResponse } from "next/server"
import { after } from "next/server"
import { db, type Order, type Project } from "@/lib/publishing/db"
import { fulfillOrder, markOrderFailed } from "@/lib/publishing/fulfill"
import { getPaymentProvider, type PaymentEvent } from "@/lib/publishing/payment"
import { chargeMatches, shouldFulfill } from "@/lib/publishing/webhook-guard"

export const runtime = "nodejs"
export const maxDuration = 120

/**
 * 결제사 웹훅 수신.
 *
 * 서명 검증 → 식별자 확인 → 멱등 장부 → 200 → after()에서 제작.
 * 재전송(23505)이어도 제작이 안 끝났으면 after()를 다시 넣는다.
 */
export async function POST(req: NextRequest) {
  // 서명은 반드시 원문으로 검증한다. 파싱 후 재직렬화하면 서식이 달라져 깨진다.
  const raw = await req.text()
  const signature = req.headers.get("X-Signature")
  const eventName = req.headers.get("X-Event-Name")

  let provider
  try {
    provider = getPaymentProvider()
  } catch {
    return NextResponse.json({ error: "결제 설정이 없습니다." }, { status: 503 })
  }

  if (!provider.verifyWebhook(raw, signature)) {
    // 위조 시도일 수 있다. 본문을 로그에 남기지 않는다.
    return NextResponse.json({ error: "서명이 올바르지 않습니다." }, { status: 401 })
  }

  const event = provider.parseEvent(raw, eventName)
  if (!event.providerOrderId) {
    return NextResponse.json({ error: "이벤트 형식이 올바르지 않습니다." }, { status: 400 })
  }
  if ((event.type === "paid" || event.type === "refunded") && !event.reference) {
    return NextResponse.json({ error: "주문 식별자가 없습니다." }, { status: 400 })
  }

  const eventId = `${event.rawEventName}:${event.providerOrderId}`
  const { error: dupError } = await db()
    .from("publishing_webhook_events")
    .insert({
      provider: provider.name,
      event_id: eventId,
      event_name: event.rawEventName,
    })
  if (dupError && dupError.code !== "23505") {
    return NextResponse.json({ error: "이벤트 기록 실패" }, { status: 500 })
  }

  if (event.type !== "paid" && event.type !== "refunded") {
    return NextResponse.json({ ok: true, ignored: event.rawEventName })
  }

  after(() => processPaidEvent(event, provider.name, eventId))
  return NextResponse.json({ ok: true, duplicate: dupError?.code === "23505" })
}

async function markProcessed(eventId: string) {
  await db()
    .from("publishing_webhook_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("provider", "lemonsqueezy")
    .eq("event_id", eventId)
}

async function processPaidEvent(event: PaymentEvent, providerName: string, eventId: string) {
  try {
    const { data: order } = await db()
      .from("publishing_orders")
      .select("*")
      .eq("id", event.reference!)
      .single<Order>()

    if (!order) throw new Error(`주문을 찾을 수 없습니다: ${event.reference}`)

    if (event.type === "refunded") {
      await db().from("publishing_orders").update({ status: "refunded" }).eq("id", order.id)
      await markProcessed(eventId)
      return
    }

    if (!shouldFulfill(order)) {
      await markProcessed(eventId)
      return
    }

    if (event.currency && event.currency !== "KRW") {
      throw new Error(`결제 통화가 ${event.currency}입니다.`)
    }
    if (!chargeMatches(event.totalMinor, order.price_krw)) {
      const chargedKrw = Math.round(event.totalMinor) / 100
      const reason = `결제 금액이 판매가와 다릅니다 (청구 ${chargedKrw}원, 판매가 ${order.price_krw}원).`
      await db()
        .from("publishing_orders")
        .update({
          status: "failed",
          failure_reason: reason.slice(0, 500),
          payment_provider: providerName,
          payment_order_id: event.providerOrderId,
          paid_at: new Date().toISOString(),
        })
        .eq("id", order.id)
      await markProcessed(eventId)
      return
    }

    await db()
      .from("publishing_orders")
      .update({
        status: "paid",
        failure_reason: null,
        payment_provider: providerName,
        payment_order_id: event.providerOrderId,
        paid_at: new Date().toISOString(),
      })
      .eq("id", order.id)

    const { data: project } = await db()
      .from("publishing_projects")
      .select("*")
      .eq("id", order.project_id)
      .single<Project>()
    if (!project) throw new Error(`프로젝트를 찾을 수 없습니다: ${order.project_id}`)

    await fulfillOrder(order, project)
    await markProcessed(eventId)
  } catch (e) {
    const reason = e instanceof Error ? e.message : "알 수 없는 오류"
    console.error("[publish/webhook] 제작 처리 실패", reason)
    if (event.reference) await markOrderFailed(event.reference, reason).catch(() => {})
  }
}
