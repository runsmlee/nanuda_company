import { NextRequest, NextResponse } from "next/server"
import { PUBLISH_ENABLED } from "@/lib/publishing/config"
import { coverGeometry, coverGuideSvg } from "@/lib/publishing/print-guide"
import { getCalculatedSize, listBookSpecs, SweetBookError } from "@/lib/publishing/sweetbook"

// 표지 도면 SVG. 위저드에 인라인으로 그리고, 저자가 내려받아 디자인 도구에
// 밑그림으로 깔 수 있게 한다.
export async function GET(req: NextRequest) {
  if (!PUBLISH_ENABLED) {
    return NextResponse.json({ error: "현재 신청을 받고 있지 않습니다." }, { status: 503 })
  }

  const specUid = req.nextUrl.searchParams.get("spec")
  const pages = Number(req.nextUrl.searchParams.get("pages"))
  if (!specUid || !Number.isInteger(pages) || pages <= 0) {
    return NextResponse.json({ error: "spec과 pages가 필요합니다." }, { status: 400 })
  }

  try {
    const [size, specs] = await Promise.all([getCalculatedSize(specUid, pages), listBookSpecs()])
    const spec = specs.find((s) => s.bookSpecUid === specUid)
    if (!spec) {
      return NextResponse.json({ error: "판형을 찾을 수 없습니다." }, { status: 404 })
    }

    const svg = coverGuideSvg(coverGeometry(size, spec.bleedMm), `${spec.name} ${pages}p`)
    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Content-Disposition": `inline; filename="cover-guide-${specUid}-${pages}p.svg"`,
        "Cache-Control": "public, max-age=3600",
      },
    })
  } catch (e) {
    if (e instanceof SweetBookError) {
      return NextResponse.json({ error: e.errors.join(" ") }, { status: e.status >= 500 ? 502 : e.status })
    }
    return NextResponse.json({ error: "가이드 생성에 실패했습니다." }, { status: 502 })
  }
}
