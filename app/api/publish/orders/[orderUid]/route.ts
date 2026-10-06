import { NextRequest, NextResponse } from "next/server"
import { authorizedOrder } from "@/lib/publishing/db"
import { getOrder, SweetBookError } from "@/lib/publishing/sweetbook"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderUid: string }> },
) {
  const { orderUid } = await params
  if (!/^[\w-]{4,64}$/.test(orderUid)) {
    return NextResponse.json({ error: "주문번호 형식이 올바르지 않습니다." }, { status: 400 })
  }

  try {
    const owned = await authorizedOrder(orderUid, req.nextUrl.searchParams.get("token") ?? undefined, true)
    if (!owned) return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 })
    const o = await getOrder(orderUid)
    return NextResponse.json({
      order: {
        orderUid: o.orderUid,
        orderStatus: o.orderStatus,
        orderStatusDisplay: o.orderStatusDisplay,
        // 제작사 금액(원가)은 응답에서 제외한다.
        recipientName: o.recipientName,
        orderedAt: o.orderedAt,
        isTest: o.isTest,
        items: (o.items ?? []).map((i) => ({
          bookTitle: i.bookTitle,
          quantity: i.quantity,
          pageCount: i.pageCount,
          itemStatusDisplay: i.itemStatusDisplay,
        })),
      },
    }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (e) {
    if (e instanceof SweetBookError && e.status === 404) {
      return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 })
    }
    return NextResponse.json({ error: "주문 조회에 실패했습니다." }, { status: 502 })
  }
}
