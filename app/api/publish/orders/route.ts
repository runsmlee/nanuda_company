import { NextRequest, NextResponse } from "next/server"
import { createOrder, SweetBookError } from "@/lib/publishing/sweetbook"
import { PUBLISH_ENABLED, PUBLISH_ORDERS_ENABLED } from "@/lib/publishing/config"
import { parseOrderInput } from "../order-input"

export async function POST(req: NextRequest) {
  // 이 경로는 결제를 거치지 않고 제작사에 인쇄를 접수한다. 결제 연동이 끝나기
  // 전까지는 스튜디오(PUBLISH_ENABLED)가 열려 있어도 별도로 막아야 한다.
  if (!PUBLISH_ENABLED || !PUBLISH_ORDERS_ENABLED) {
    return NextResponse.json({ error: "주문을 받고 있지 않습니다." }, { status: 503 })
  }

  const parsed = await parseOrderInput(req)
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }
  if (!parsed.idempotencyKey) {
    // 이중 청구 방지 장치 없이 주문을 만들지 않는다.
    return NextResponse.json({ error: "주문 식별키가 없습니다. 페이지를 새로고침 후 다시 시도해주세요." }, { status: 400 })
  }

  try {
    const order = await createOrder(parsed.order, parsed.idempotencyKey)
    // 제작사 금액(원가)은 응답에 담지 않는다. 저자에게 보여줄 금액은 판매가뿐이다.
    return NextResponse.json({
      order: {
        orderUid: order.orderUid,
        orderStatus: order.orderStatus,
        orderStatusDisplay: order.orderStatusDisplay,
        orderedAt: order.orderedAt,
      },
    })
  } catch (e) {
    if (e instanceof SweetBookError) {
      // 402(충전금 부족)는 운영 이슈다: 사용자에게는 접수 불가 안내만 노출한다.
      const errors =
        e.errorCode === "ERR_INSUFFICIENT_CREDIT"
          ? ["일시적으로 주문 접수가 어렵습니다. 잠시 후 다시 시도하시거나 문의해주세요."]
          : e.errors
      return NextResponse.json(
        { errorCode: e.errorCode, errors },
        { status: e.status >= 500 ? 502 : e.status },
      )
    }
    return NextResponse.json({ errors: ["주문 생성에 실패했습니다."] }, { status: 502 })
  }
}
