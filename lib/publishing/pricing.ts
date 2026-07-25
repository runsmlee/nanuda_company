// 판매가 산정. 제작사 원가에 마진을 얹어 저자에게 제시할 금액을 만든다.
//
// 중요: SweetBook의 `totalAmount`는 **부가세 제외** 금액이고, 충전금에서 실제로
// 차감되는 금액은 `paidCreditAmount` = floor(totalAmount × 1.1 / 10) × 10 이다.
// 원가는 반드시 부가세 포함 금액으로 잡아야 한다. (실측 검증: 26,527 → 29,170)

/**
 * 마진율 = (판매가 − 원가) / 판매가 — 매출 총이익률 기준.
 * (원가 대비 markup이 아니다. 30% 마진 → 판매가 = 원가 ÷ 0.7)
 *
 * 수량이 늘수록 마진을 낮춘다. 1권은 고정비 성격이 크므로 가장 높게 잡는다.
 */
const MARGIN_TIERS: { minQty: number; rate: number }[] = [
  { minQty: 30, rate: 0.20 },
  { minQty: 10, rate: 0.25 },
  { minQty: 5, rate: 0.30 },
  { minQty: 2, rate: 0.35 },
  { minQty: 1, rate: 0.40 },
]

export function marginRate(quantity: number): number {
  const tier = MARGIN_TIERS.find((t) => quantity >= t.minQty)
  return tier ? tier.rate : 0.30
}

/** SweetBook totalAmount(부가세 제외) → 실제 충전금 차감액(부가세 포함). */
export function costWithVat(totalAmountExclVat: number): number {
  return Math.floor((totalAmountExclVat * 1.1) / 10) * 10
}

/** 원가(부가세 포함) → 저자에게 제시할 판매가. 100원 단위 올림. */
export function sellingPrice(costInclVat: number, quantity: number): number {
  const rate = marginRate(quantity)
  return Math.ceil(costInclVat / (1 - rate) / 100) * 100
}

/** 판형 단가표로 계산한 1권 제작 원가(부가세 제외). 배송비 미포함. */
export function unitCostExclVat(
  spec: { pageMin: number; pageIncrement: number; priceBase: number; pricePerIncrement: number },
  pages: number,
): number {
  const extra = Math.max(0, pages - spec.pageMin)
  const increments = spec.pageIncrement > 0 ? extra / spec.pageIncrement : 0
  return spec.priceBase + increments * spec.pricePerIncrement
}

/**
 * 위저드 1단계용 개략 판매가. 배송비를 모르는 시점이라 상품가만 계산한다.
 * 확정 금액은 서버 견적(`/api/publish/estimate`)이 배송비까지 반영해 다시 준다.
 */
export function estimateProductPrice(
  spec: { pageMin: number; pageIncrement: number; priceBase: number; pricePerIncrement: number },
  pages: number,
  quantity: number,
): number {
  const cost = costWithVat(unitCostExclVat(spec, pages) * quantity)
  return sellingPrice(cost, quantity)
}
