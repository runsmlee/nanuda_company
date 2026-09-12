import { createHmac, timingSafeEqual } from "node:crypto"

const MAX_SKEW_SEC = 300

/**
 * SweetBook 서명: HMAC-SHA256(secret, `${timestamp}.${rawBody}`)
 * 헤더는 `sha256={hex}`. 본문은 원문 그대로 — JSON 재직렬화하면 깨진다.
 */
export function verifySweetbookWebhook(
  rawBody: string,
  signature: string | null,
  timestamp: string | null,
  secret: string,
  nowSec = Math.floor(Date.now() / 1000),
): boolean {
  if (!signature || !timestamp || !secret) return false
  if (!/^\d+$/.test(timestamp)) return false
  const ts = Number(timestamp)
  if (Math.abs(nowSec - ts) > MAX_SKEW_SEC) return false

  const expected = `sha256=${createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex")}`
  const given = Buffer.from(signature, "utf8")
  const want = Buffer.from(expected, "utf8")
  if (given.length !== want.length) return false
  return timingSafeEqual(given, want)
}

export function parseSweetbookEvent(rawBody: string): {
  eventUid: string
  eventType: string
  orderUid: string | null
  orderStatus: string | null
} {
  const body = JSON.parse(rawBody)
  const data = body?.data ?? {}
  const eventUid = body?.event_uid ?? body?.eventUid ?? ""
  const eventType = body?.event_type ?? body?.eventType ?? ""
  const orderUid = data.order_uid ?? data.orderUid ?? body?.order_uid ?? body?.orderUid
  const orderStatus = data.order_status ?? data.orderStatus
  return {
    eventUid: eventUid ? String(eventUid) : "",
    eventType: eventType ? String(eventType) : "",
    orderUid: orderUid ? String(orderUid) : null,
    orderStatus: orderStatus ? String(orderStatus) : null,
  }
}
