import { NextRequest, NextResponse, after } from "next/server"
import { db } from "@/lib/publishing/db"
import { getOrder } from "@/lib/publishing/sweetbook"
import { runPaymentWork } from "@/lib/publishing/payment-work"
import { parseSweetbookEvent, verifySweetbookWebhook } from "@/lib/publishing/sweetbook-webhook"

export const runtime = "nodejs"
export const maxDuration = 120
export async function POST(req: NextRequest) {
  const secret = process.env.SWEETBOOK_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: "제작사 웹훅 설정이 없습니다." }, { status: 503 })
  const raw = await req.text()
  if (!verifySweetbookWebhook(raw, req.headers.get("X-Webhook-Signature"), req.headers.get("X-Webhook-Timestamp"), secret)) {
    return NextResponse.json({ error: "서명이 올바르지 않습니다." }, { status: 401 })
  }
  let event
  try {
    event = parseSweetbookEvent(raw)
    if (!event.eventUid || !event.orderUid) throw new Error("Missing identity")
  } catch { return NextResponse.json({ error: "이벤트 형식이 올바르지 않습니다." }, { status: 400 }) }
  let status: string
  try {
    const current = await getOrder(event.orderUid)
    if (current.orderUid !== event.orderUid) throw new Error("Supplier identity mismatch")
    status = current.orderStatus
  } catch { return NextResponse.json({ error: "제작사 상태 조회 실패" }, { status: 503 }) }
  const { data, error } = await db().rpc("publishing_record_print_event", {
    p_event_id: event.eventUid, p_event_name: event.eventType, p_print_uid: event.orderUid, p_status: status,
  })
  if (error || !data) return NextResponse.json({ error: "주문 상태를 확인하지 못했습니다." }, { status: 503 })
  after(async () => { await runPaymentWork().catch(() => console.error("[publish/work] wakeup failed")) })
  return NextResponse.json({ ok: true })
}
