// 가격 로직 자체 점검. 실행: node lib/publishing/pricing.test.mjs
// 마진이 깨지면 조용히 손해가 나므로, 최소 마진 보장만큼은 검증한다.
import assert from "node:assert/strict"

// pricing.ts와 동일한 정책 (TS 런타임 없이 검증하기 위한 최소 복제)
const MARGIN_TIERS = [
  { minQty: 30, rate: 0.20 },
  { minQty: 10, rate: 0.25 },
  { minQty: 5, rate: 0.30 },
  { minQty: 2, rate: 0.35 },
  { minQty: 1, rate: 0.40 },
]
const marginRate = (q) => (MARGIN_TIERS.find((t) => q >= t.minQty) ?? { rate: 0.3 }).rate
const costWithVat = (t) => Math.floor((t * 1.1) / 10) * 10
const sellingPrice = (cost, q) => Math.ceil(cost / (1 - marginRate(q)) / 100) * 100

// 1. 부가세 계산이 SweetBook 실측값과 일치해야 한다
assert.equal(costWithVat(26527), 29170, "실측 주문 or_3cEedZrGzfFr")
assert.equal(costWithVat(14627), 16080, "실측 주문 or_2Kbe6HGXuMzh")

// 2. 판매가는 언제나 원가보다 커야 한다 (마이너스 마진 방지)
for (const cost of [5000, 16080, 29170, 100000, 999999]) {
  for (const qty of [1, 2, 5, 10, 30, 100]) {
    const price = sellingPrice(cost, qty)
    assert.ok(price > cost, `판매가 ${price} <= 원가 ${cost} (${qty}권)`)
  }
}

// 3. 실현 마진이 정책 마진 이상이어야 한다 (100원 올림 때문에 항상 >=)
for (const cost of [16080, 29170, 47500]) {
  for (const qty of [1, 2, 5, 10, 30]) {
    const price = sellingPrice(cost, qty)
    const actual = (price - cost) / price
    assert.ok(actual >= marginRate(qty) - 1e-9, `${qty}권: 실현 ${(actual * 100).toFixed(1)}% < 목표 ${marginRate(qty) * 100}%`)
  }
}

// 4. 최저 마진은 20% 아래로 내려가지 않는다
for (const qty of [1, 50, 1000]) assert.ok(marginRate(qty) >= 0.20)

// 5. 수량이 늘수록 마진율은 단조 감소한다
let prev = 1
for (const qty of [1, 2, 5, 10, 30, 100]) {
  const r = marginRate(qty)
  assert.ok(r <= prev, `마진율이 증가함: ${qty}권`)
  prev = r
}

console.log("pricing: 모든 검증 통과")
console.table(
  [1, 2, 5, 10, 30].map((q) => {
    const cost = costWithVat(11900 * q + 3000)
    const price = sellingPrice(cost, q)
    return {
      수량: q,
      "원가(VAT포함)": cost.toLocaleString(),
      판매가: price.toLocaleString(),
      "권당": Math.round(price / q).toLocaleString(),
      "마진율": `${(((price - cost) / price) * 100).toFixed(1)}%`,
    }
  }),
)
