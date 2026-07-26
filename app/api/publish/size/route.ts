import { NextRequest, NextResponse } from "next/server"
import { getCalculatedSize, SweetBookError } from "@/lib/publishing/sweetbook"

export async function GET(req: NextRequest) {
  const spec = req.nextUrl.searchParams.get("spec")
  const pages = Number(req.nextUrl.searchParams.get("pages"))
  if (!spec || !Number.isInteger(pages) || pages <= 0) {
    return NextResponse.json({ error: "spec과 pages가 필요합니다." }, { status: 400 })
  }

  try {
    const size = await getCalculatedSize(spec, pages)
    return NextResponse.json({ size })
  } catch (e) {
    if (e instanceof SweetBookError) {
      return NextResponse.json({ error: e.errors.join(" ") }, { status: e.status >= 500 ? 502 : e.status })
    }
    return NextResponse.json({ error: "사이즈 계산에 실패했습니다." }, { status: 502 })
  }
}
