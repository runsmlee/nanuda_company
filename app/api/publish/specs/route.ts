import { NextResponse } from "next/server"
import { listBookSpecs, SweetBookError } from "@/lib/publishing/sweetbook"

export const revalidate = 3600

export async function GET() {
  try {
    const specs = await listBookSpecs()
    return NextResponse.json({ specs })
  } catch (e) {
    const status = e instanceof SweetBookError ? e.status : 500
    return NextResponse.json(
      { error: "판형 정보를 불러오지 못했습니다." },
      { status: status >= 500 ? 502 : status },
    )
  }
}
