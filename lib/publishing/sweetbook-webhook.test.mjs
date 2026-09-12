import assert from "node:assert/strict"
import { createHmac, timingSafeEqual } from "node:crypto"

const SECRET = "whsk_test_secret"
const MAX_SKEW_SEC = 300

function verify(rawBody, signature, timestamp, secret = SECRET, nowSec = 1_709_280_000) {
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

const raw = JSON.stringify({
  event_uid: "evt_a1",
  event_type: "order.created",
  data: { order_uid: "or_1", order_status: "PDF_READY" },
})
const ts = "1709280000"
const sign = (body, timestamp = ts) =>
  `sha256=${createHmac("sha256", SECRET).update(`${timestamp}.${body}`, "utf8").digest("hex")}`

assert.equal(verify(raw, sign(raw), ts), true, "정상 서명")
assert.equal(verify(raw.replace("PDF_READY", "PAID"), sign(raw), ts), false, "본문 변조")
assert.equal(verify(raw, sign(raw, "1709280301"), ts), false, "다른 timestamp로 만든 서명")
assert.equal(verify(raw, sign(raw), "1709279699"), false, "5분 초과")
assert.equal(verify(raw, null, ts), false, "서명 없음")

console.log("sweetbook-webhook: 서명 검증 통과")
