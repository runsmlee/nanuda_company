import { NextRequest, NextResponse } from "next/server"
import { estimateOrder, SweetBookError } from "@/lib/publishing/sweetbook"
import { PUBLISH_ENABLED } from "@/lib/publishing/config"
import { costWithVat, marginRate, sellingPrice } from "@/lib/publishing/pricing"
import { parseOrderInput } from "../order-input"

export async function POST(req: NextRequest) {
  if (!PUBLISH_ENABLED) {
    return NextResponse.json({ error: "현재 신청을 받고 있지 않습니다." }, { status: 503 })
  }

  const parsed = await parseOrderInput(req)
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  try {
    const estimate = await estimateOrder(parsed.order)
    const quantity = parsed.order.items[0]?.quantity ?? 1

    // 제작사 totalAmount는 부가세 제외 금액이다. 원가는 실제 차감액(paidCreditAmount)
    // 기준으로 잡고, 그 위에 마진을 얹은 값만 저자에게 노출한다.
    const cost = estimate.paidCreditAmount ?? costWithVat(estimate.totalAmount ?? 0)
    const price = sellingPrice(cost, quantity)

    return NextResponse.json({
      estimate: {
        totalPrice: price,
        unitPrice: Math.round(price / quantity),
        quantity,
        // 원가·마진율은 응답에 담지 않는다 (클라이언트로 새어나갈 이유가 없다).
      },
      _internal: process.env.NODE_ENV === "development" ? { cost, marginRate: marginRate(quantity) } : undefined,
    })
  } catch (e) {
    if (e instanceof SweetBookError) {
      return NextResponse.json(
        { errorCode: e.errorCode, errors: e.errors },
        { status: e.status >= 500 ? 502 : e.status },
      )
    }
    return NextResponse.json({ errors: ["견적 조회에 실패했습니다."] }, { status: 502 })
  }
}
