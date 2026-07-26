import { NextRequest, NextResponse } from "next/server"
import { PUBLISH_ENABLED } from "@/lib/publishing/config"
import { COVER_THEMES, renderCover, type CoverTheme } from "@/lib/publishing/cover"
import { getCalculatedSize, listBookSpecs, SweetBookError } from "@/lib/publishing/sweetbook"

export const runtime = "nodejs"
export const maxDuration = 60

const MAX_IMAGE_BYTES = 8 * 1024 * 1024

/** 쪽수 + 문구 → 인쇄용 표지 PDF. 책등 두께는 쪽수에서 계산된다. */
export async function POST(req: NextRequest) {
  if (!PUBLISH_ENABLED) {
    return NextResponse.json({ error: "현재 신청을 받고 있지 않습니다." }, { status: 503 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 })
  }

  const specUid = String(form.get("bookSpecUid") ?? "")
  const pages = Number(form.get("pages"))
  const theme = String(form.get("theme") ?? "ivory") as CoverTheme
  const title = String(form.get("title") ?? "").trim() || "제목 없음"
  const authorName = String(form.get("authorName") ?? "").trim() || "저자 미상"
  const publisher = String(form.get("publisher") ?? "").trim() || "생각을나누다"
  const backText = String(form.get("backText") ?? "").slice(0, 600)
  const image = form.get("image")

  if (!Number.isInteger(pages) || pages <= 0) {
    return NextResponse.json({ error: "쪽수가 올바르지 않습니다. 먼저 조판해주세요." }, { status: 400 })
  }
  if (!(theme in COVER_THEMES)) {
    return NextResponse.json({ error: "표지 스타일 값이 올바르지 않습니다." }, { status: 400 })
  }

  let imageBuffer: Buffer | undefined
  if (image instanceof File && image.size > 0) {
    if (image.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "표지 이미지는 8MB 이하만 올릴 수 있습니다." }, { status: 400 })
    }
    if (!/^image\/(jpeg|png)$/.test(image.type)) {
      return NextResponse.json({ error: "표지 이미지는 JPG 또는 PNG만 지원합니다." }, { status: 400 })
    }
    imageBuffer = Buffer.from(await image.arrayBuffer())
  }

  try {
    const specs = await listBookSpecs()
    const spec = specs.find((s) => s.bookSpecUid === specUid) ?? specs[0]
    if (!spec) {
      return NextResponse.json({ error: "판형 정보를 불러오지 못했습니다." }, { status: 502 })
    }

    // 책등 두께는 제작사가 계산한 값을 그대로 쓴다. 우리가 다시 계산하면 어긋난다.
    const size = await getCalculatedSize(spec.bookSpecUid, pages)
    const result = await renderCover(size, spec.bleedMm, {
      title,
      authorName,
      publisher,
      backText,
      theme,
      image: imageBuffer,
    })

    const summary = {
      widthMm: size.coverWidthMm,
      heightMm: size.coverHeightMm,
      spineWidthMm: size.spineWidthMm,
      spineTextIncluded: result.spineTextIncluded,
      notes: result.notes,
    }

    return new NextResponse(new Uint8Array(result.pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="cover-${pages}p.pdf"`,
        "X-Cover-Summary": Buffer.from(JSON.stringify(summary), "utf8").toString("base64"),
        "Cache-Control": "no-store",
      },
    })
  } catch (e) {
    if (e instanceof SweetBookError) {
      return NextResponse.json({ error: e.errors.join(" ") }, { status: e.status >= 500 ? 502 : e.status })
    }
    const msg = e instanceof Error ? e.message : "표지 생성에 실패했습니다."
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
