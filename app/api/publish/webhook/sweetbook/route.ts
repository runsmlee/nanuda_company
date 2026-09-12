import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/publishing/db"
import { parseSweetbookEvent, verifySweetbookWebhook } from "@/lib/publishing/sweetbook-webhook"

export const runtime = "nodejs"

/**
 * 제작사 상태 웹훅. 결제를 시작하지 않는다 — 이미 넣은 주문의 print_status만 갱신한다.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.SWEETBOOK_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: "제작사 웹훅 설정이 없습니다." }, { status: 503 })
  }

  const raw = await req.text()
  const signature = req.headers.get("X-Webhook-Signature")
  const timestamp = req.headers.get("X-Webhook-Timestamp")

  if (!verifySweetbookWebhook(raw, signature, timestamp, secret)) {
    return NextResponse.json({ error: "서명이 올바르지 않습니다." }, { status: 401 })
  }

  let event
  try {
    event = parseSweetbookEvent(raw)
  } catch {
    return NextResponse.json({ error: "이벤트 형식이 올바르지 않습니다." }, { status: 400 })
  }
  if (!event.eventUid) {
    return NextResponse.json({ error: "이벤트 형식이 올바르지 않습니다." }, { status: 400 })
  }

  const { error: dupError } = await db()
    .from("publishing_webhook_events")
    .insert({
      provider: "sweetbook",
      event_id: event.eventUid,
      event_name: event.eventType,
    })
  if (dupError) {
    if (dupError.code === "23505") return NextResponse.json({ ok: true, duplicate: true })
    return NextResponse.json({ error: "이벤트 기록 실패" }, { status: 500 })
  }

  const patch: { print_status?: string } = {}
  if (event.orderUid && event.orderStatus) patch.print_status = event.orderStatus

  if (event.orderUid && Object.keys(patch).length > 0) {
    const { error } = await db()
      .from("publishing_orders")
      .update(patch)
      .eq("print_order_uid", event.orderUid)
    if (error) {
      console.error("[publish/webhook/sweetbook] 상태 갱신 실패", error.message)
      return NextResponse.json({ error: "상태 갱신 실패" }, { status: 500 })
    }
  }

  await db()
    .from("publishing_webhook_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("provider", "sweetbook")
    .eq("event_id", event.eventUid)

  return NextResponse.json({ ok: true })
}
