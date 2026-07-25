import { NextRequest } from "next/server"
import type { OrderRequest } from "@/lib/publishing/sweetbook"

// 견적과 주문이 동일한 본문을 쓰므로 검증을 한 곳에 둔다.
// 배송지 입력은 신뢰 경계이므로 서버에서 다시 검증한다.
export async function parseOrderInput(
  req: NextRequest,
): Promise<{ order: OrderRequest; idempotencyKey?: string } | { error: string }> {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return { error: "요청 형식이 올바르지 않습니다." }
  }

  const bookUid = typeof body.bookUid === "string" ? body.bookUid.trim() : ""
  const quantity = Number(body.quantity)
  const s = (body.shipping ?? {}) as Record<string, unknown>
  const str = (v: unknown, max: number) =>
    typeof v === "string" && v.trim().length > 0 && v.trim().length <= max ? v.trim() : null

  if (!bookUid) return { error: "책 정보가 없습니다. 이전 단계를 먼저 완료해주세요." }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
    return { error: "수량은 1~100권 사이여야 합니다." }
  }

  const recipientName = str(s.recipientName, 100)
  const recipientPhone = str(s.recipientPhone, 20)
  const postalCode = str(s.postalCode, 10)
  const address1 = str(s.address1, 200)
  if (!recipientName) return { error: "받는 분 성함을 입력해주세요." }
  if (!recipientPhone || !/^[0-9+\-\s]{9,20}$/.test(recipientPhone)) {
    return { error: "연락처를 확인해주세요." }
  }
  if (!postalCode || !/^\d{5}$/.test(postalCode)) return { error: "우편번호 5자리를 입력해주세요." }
  if (!address1) return { error: "주소를 입력해주세요." }

  const address2 = str(s.address2, 200) ?? undefined
  const memo = str(s.memo, 200) ?? undefined
  const idempotencyKey =
    typeof body.idempotencyKey === "string" && /^[\w-]{8,64}$/.test(body.idempotencyKey)
      ? body.idempotencyKey
      : undefined

  return {
    order: {
      items: [{ bookUid, quantity }],
      shipping: { recipientName, recipientPhone, postalCode, address1, address2, memo },
      externalRef: idempotencyKey ? `nanuda-${idempotencyKey}` : undefined,
    },
    idempotencyKey,
  }
}
