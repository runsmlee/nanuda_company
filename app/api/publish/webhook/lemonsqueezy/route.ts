import { NextRequest, NextResponse } from "next/server"
import { after } from "next/server"
import { db, type Order, type Project } from "@/lib/publishing/db"
import { fulfillOrder, markOrderFailed } from "@/lib/publishing/fulfill"
import { getPaymentProvider } from "@/lib/publishing/payment"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * 결제사 웹훅 수신.
 *
 * 순서가 중요하다: 서명 검증 → 멱등 장부 기록 → 200 응답 → 뒤에서 제작 처리.
 * 레몬스퀴지는 5초 안에 200이 없으면 최대 3회 재전송하는데, 조판과 제작사 업로드는
 * 그보다 오래 걸린다. 먼저 응답하고 after()로 이어서 처리한다.
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

  // 멱등 장부. 재전송이 와도 두 번 처리하지 않는다.
  const { error: dupError } = await db()
    .from("publishing_webhook_events")
    .insert({
      provider: provider.name,
      event_id: `${event.rawEventName}:${event.providerOrderId}`,
      event_name: event.rawEventName,
    })
  if (dupError) {
    // unique 위반 = 이미 받은 이벤트. 정상 처리로 간주하고 200을 준다.
    if (dupError.code === "23505") return NextResponse.json({ ok: true, duplicate: true })
    return NextResponse.json({ error: "이벤트 기록 실패" }, { status: 500 })
  }

  if (event.type !== "paid" && event.type !== "refunded") {
    return NextResponse.json({ ok: true, ignored: event.rawEventName })
  }
  if (!event.reference) {
    return NextResponse.json({ error: "주문 식별자가 없습니다." }, { status: 400 })
  }

  // 여기서부터는 응답을 먼저 주고 뒤에서 처리한다.
  after(async () => {
    try {
      const { data: order } = await db()
        .from("publishing_orders")
        .select("*")
        .eq("id", event.reference!)
        .single<Order>()

      if (!order) throw new Error(`주문을 찾을 수 없습니다: ${event.reference}`)

      if (event.type === "refunded") {
        await db().from("publishing_orders").update({ status: "refunded" }).eq("id", order.id)
        return
      }

      // 이미 제작사에 넘어간 주문은 건드리지 않는다.
      if (order.status === "submitted" || order.print_order_uid) return

      await db()
        .from("publishing_orders")
        .update({
          status: "paid",
          payment_provider: provider.name,
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
    } catch (e) {
      const reason = e instanceof Error ? e.message : "알 수 없는 오류"
      console.error("[publish/webhook] 제작 처리 실패", reason)
      if (event.reference) await markOrderFailed(event.reference, reason).catch(() => {})
      // 결제는 이미 끝났다. 실패를 기록해 운영자가 환불하거나 재시도하게 한다.
    }
  })

  return NextResponse.json({ ok: true })
}
