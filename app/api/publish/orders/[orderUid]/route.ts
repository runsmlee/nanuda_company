import { NextRequest, NextResponse } from "next/server"
import { getOrder, SweetBookError } from "@/lib/publishing/sweetbook"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderUid: string }> },
) {
  const { orderUid } = await params
  if (!/^[\w-]{4,64}$/.test(orderUid)) {
    return NextResponse.json({ error: "주문번호 형식이 올바르지 않습니다." }, { status: 400 })
  }

  try {
    const o = await getOrder(orderUid)
    return NextResponse.json({
      order: {
        orderUid: o.orderUid,
        orderStatus: o.orderStatus,
        orderStatusDisplay: o.orderStatusDisplay,
        totalAmount: o.totalAmount,
        totalProductAmount: o.totalProductAmount,
        totalShippingFee: o.totalShippingFee,
        recipientName: o.recipientName,
        orderedAt: o.orderedAt,
        isTest: o.isTest,
        items: (o.items ?? []).map((i) => ({
          bookTitle: i.bookTitle,
          quantity: i.quantity,
          pageCount: i.pageCount,
          itemAmount: i.itemAmount,
          itemStatusDisplay: i.itemStatusDisplay,
        })),
      },
    })
  } catch (e) {
    if (e instanceof SweetBookError && e.status === 404) {
      return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 })
    }
    return NextResponse.json({ error: "주문 조회에 실패했습니다." }, { status: 502 })
  }
}
