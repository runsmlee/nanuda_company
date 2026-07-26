// 웹훅 서명 검증 자체 점검. 실행: node lib/publishing/payment.test.mjs
//
// 서명 검증이 뚫리면 아무나 결제 완료를 위조해 무료로 책을 인쇄할 수 있다.
// 결제사 계정 없이도 검증 가능한 부분이므로 반드시 테스트한다.
import assert from "node:assert/strict"
import { createHmac, timingSafeEqual } from "node:crypto"

const SECRET = "test-signing-secret"

// payment.ts의 verifyWebhook과 동일한 로직 (TS 런타임 없이 검증하기 위한 사본)
function verify(rawBody, signature, secret = SECRET) {
  if (!signature) return false
  const digest = Buffer.from(createHmac("sha256", secret).update(rawBody, "utf8").digest("hex"), "utf8")
  const given = Buffer.from(signature, "utf8")
  if (digest.length !== given.length) return false
  return timingSafeEqual(digest, given)
}
const sign = (body, secret = SECRET) =>
  createHmac("sha256", secret).update(body, "utf8").digest("hex")

const payload = JSON.stringify({
  meta: { event_name: "order_created", custom_data: { reference: "nanuda-abc123", kind: "physical" } },
  data: { id: "9911", type: "orders", attributes: { status: "paid", total: 26800, currency: "KRW", user_email: "a@b.com" } },
})

// 1. 올바른 서명은 통과
assert.equal(verify(payload, sign(payload)), true, "정상 서명")

// 2. 본문이 한 글자만 바뀌어도 실패 — 금액 위조 방지의 핵심
const tampered = payload.replace('"total":26800', '"total":100')
assert.equal(verify(tampered, sign(payload)), false, "본문 변조")

// 3. 다른 비밀키로 만든 서명은 실패
assert.equal(verify(payload, sign(payload, "wrong-secret")), false, "잘못된 비밀키")

// 4. 서명 누락·빈 값·길이 불일치에서 예외 없이 false
assert.equal(verify(payload, null), false, "서명 없음")
assert.equal(verify(payload, ""), false, "빈 서명")
assert.equal(verify(payload, "deadbeef"), false, "짧은 서명")
assert.equal(verify(payload, sign(payload) + "00"), false, "긴 서명")

// 5. 원문 그대로 계산해야 한다 — 파싱 후 재직렬화하면 서식이 달라져 깨진다.
//    라우트에서 req.json()으로 받아 다시 stringify하면 이 함정에 빠진다.
const reserialized = JSON.stringify(JSON.parse(payload), null, 2)
assert.notEqual(reserialized, payload)
assert.equal(verify(reserialized, sign(payload)), false, "재직렬화 본문은 불일치해야 정상")

// 6. 한글이 포함된 본문도 utf8로 일관되게 처리
const korean = JSON.stringify({ meta: { custom_data: { title: "길에서 만나다" } } })
assert.equal(verify(korean, sign(korean)), true, "한글 본문")

console.log("payment: 웹훅 서명 검증 6종 통과")
