import assert from "node:assert/strict"

const UNDERCHARGE_MAX_KRW = 500
const expectedChargeMinor = (priceKrw) => Math.round(priceKrw) * 100
const chargeMatches = (totalMinor, priceKrw) => {
  if (!Number.isFinite(totalMinor) || totalMinor <= 0) return false
  const listed = expectedChargeMinor(priceKrw)
  if (totalMinor > listed) return false
  return listed - totalMinor <= UNDERCHARGE_MAX_KRW * 100
}
const impliedChargeMinor = (preview) => {
  const listedStyle = Number(preview.total) || 0
  const usdMinor = Number(preview.total_usd)
  const rate = Number(preview.currency_rate)
  if (usdMinor > 0 && rate > 0) {
    const fromUsd = Math.round(usdMinor / rate)
    return Math.max(listedStyle, fromUsd)
  }
  return listedStyle
}
const sendKrwForCeiling = (listedKrw, currencyRate) => {
  if (!(currencyRate > 0) || listedKrw < 1) return Math.max(1, listedKrw)
  const maxUsdCents = Math.floor(listedKrw * currencyRate * 100 + 1e-9)
  let lo = 1
  let hi = listedKrw
  let best = 1
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (Math.round(mid * currencyRate * 100) <= maxUsdCents) {
      best = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return Math.max(1, best - 10)
}
const nextSendKrw = (listedKrw, sentKrw, previewTotalMinor) => {
  const previewKrw = previewTotalMinor / 100
  if (previewKrw <= listedKrw) return null
  const next = Math.floor(sentKrw - (previewKrw - listedKrw) - 1)
  if (next >= sentKrw) return sentKrw - 1
  return next
}
const shouldFulfill = (order) => {
  if (order.print_order_uid) return false
  return order.status === "pending" || order.status === "paid" || order.status === "failed"
}

assert.equal(expectedChargeMinor(22800), 2280000)
assert.equal(chargeMatches(2280000, 22800), true, "정확히 일치")
assert.equal(chargeMatches(2280187, 22800), false, "표시가보다 ₩1.87 많음")
assert.equal(chargeMatches(2280502, 22800), false, "표시가보다 ₩5.02 많음")
assert.equal(chargeMatches(2280001, 22800), false, "1센트라도 초과")
assert.equal(chargeMatches(2278000, 22800), true, "₩20 적게 청구")
assert.equal(chargeMatches(2230000, 22800), true, "₩500 적게 청구")
assert.equal(chargeMatches(2229900, 22800), false, "₩501 미만은 사기 의심")
assert.equal(chargeMatches(100000, 22800), false, "금액 크게 어긋남")
assert.equal(chargeMatches(0, 22800), false, "total 없음")

assert.equal(nextSendKrw(22800, 22800, 2280000), null, "미리보기가 표시가 이하")
assert.equal(nextSendKrw(22800, 22800, 2280502), 22793, "실측 ₩5.02 초과분만큼 낮춤")
assert.equal(
  impliedChargeMinor({ total: 2280000, total_usd: 1700, currency_rate: 0.00074545 }),
  2280502,
  "미리보기 원화가 아니라 달러 환산이 실제 청구",
)
{
  const send = sendKrwForCeiling(22800, 0.00074545)
  const usdCents = Math.round(send * 0.00074545 * 100)
  const chargedKrw = usdCents / 0.00074545 / 100
  assert.ok(send < 22800, "천장 아래를 넣는다")
  assert.ok(chargedKrw <= 22800, "달러 반올림 후에도 표시가 이하")
}

assert.equal(shouldFulfill({ status: "pending", print_order_uid: null }), true)
assert.equal(shouldFulfill({ status: "paid", print_order_uid: null }), true)
assert.equal(shouldFulfill({ status: "failed", print_order_uid: null }), true)
assert.equal(shouldFulfill({ status: "submitted", print_order_uid: null }), false)
assert.equal(shouldFulfill({ status: "failed", print_order_uid: "or_1" }), false)
assert.equal(shouldFulfill({ status: "refunded", print_order_uid: null }), false)

console.log("webhook-guard: 금액 대사·재제작 조건 통과")
