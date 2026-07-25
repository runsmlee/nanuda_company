import { NextRequest, NextResponse } from "next/server"
import { estimateOrder, SweetBookError } from "@/lib/publishing/sweetbook"
import { parseOrderInput } from "../order-input"

export async function POST(req: NextRequest) {
  const parsed = await parseOrderInput(req)
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  try {
    const estimate = await estimateOrder(parsed.order)
    return NextResponse.json({ estimate })
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
