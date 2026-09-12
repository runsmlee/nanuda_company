/** 레몬스퀴지 `total`은 항상 cents. 판매가 원 × 100과 비교한다. */
export function expectedChargeMinor(priceKrw: number): number {
  return Math.round(priceKrw) * 100
}

/** 표시가보다 적게 받는 것은 허용. 환전 때문에 몇 십 원은 내려갈 수 있다. */
export const UNDERCHARGE_MAX_KRW = 500

/**
 * 표시가는 천장이다. 1원이라도 더 받으면 안 된다.
 * 너무 적게 받은 웹훅은 위조·다른 주문으로 보고 거절한다.
 */
export function chargeMatches(totalMinor: number, priceKrw: number): boolean {
  if (!Number.isFinite(totalMinor) || totalMinor <= 0) return false
  const listed = expectedChargeMinor(priceKrw)
  if (totalMinor > listed) return false
  return listed - totalMinor <= UNDERCHARGE_MAX_KRW * 100
}

/**
 * 미리보기 `total`은 우리가 넣은 원화라 항상 맞아 보인다.
 * 실제 카드 청구는 `total_usd`를 환율로 되돌린 값이다.
 */
export function impliedChargeMinor(preview: {
  total?: number
  total_usd?: number
  currency_rate?: number | string
}): number {
  const listedStyle = Number(preview.total) || 0
  const usdMinor = Number(preview.total_usd)
  const rate = Number(preview.currency_rate)
  if (usdMinor > 0 && rate > 0) {
    const fromUsd = Math.round(usdMinor / rate)
    return Math.max(listedStyle, fromUsd)
  }
  return listedStyle
}

/** 달러 반올림 후에도 표시가를 넘지 않는 최대 전송 원화. */
export function sendKrwForCeiling(listedKrw: number, currencyRate: number): number {
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
  // 결제 순간 환율이 조금 움직여도 넘치지 않게 10원 더 낮춘다.
  return Math.max(1, best - 10)
}

/**
 * 미리보기 청구가 표시가를 넘으면, 다음에 넣을 판매가(원)를 낮춘다.
 * 이미 이하면 null.
 */
export function nextSendKrw(
  listedKrw: number,
  sentKrw: number,
  previewTotalMinor: number,
): number | null {
  const previewKrw = previewTotalMinor / 100
  if (previewKrw <= listedKrw) return null
  const next = Math.floor(sentKrw - (previewKrw - listedKrw) - 1)
  if (next >= sentKrw) return sentKrw - 1
  return next
}

/** 결제는 끝났는데 제작이 안 끝난 주문만 다시 넣는다. */
export function shouldFulfill(order: {
  status: string
  print_order_uid: string | null
}): boolean {
  if (order.print_order_uid) return false
  return order.status === "pending" || order.status === "paid" || order.status === "failed"
}
