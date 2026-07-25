import { NextRequest, NextResponse } from "next/server"
import { PUBLISH_ENABLED } from "@/lib/publishing/config"
import { parseManuscriptFile } from "@/lib/publishing/manuscript"
import { estimateProductPrice } from "@/lib/publishing/pricing"
import { listBookSpecs, SweetBookError } from "@/lib/publishing/sweetbook"
import { fitToSpec, TEXT_SIZES, typeset, type TextSize } from "@/lib/publishing/typeset"

// 조판은 CPU를 오래 쓴다. Edge가 아닌 Node 런타임에서 돌린다.
export const runtime = "nodejs"
export const maxDuration = 60

/** 원고 + 옵션 → 인쇄용 내지 PDF. 결과 요약은 헤더로, PDF는 본문으로 돌려준다. */
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

  const file = form.get("manuscript")
  const specUid = String(form.get("bookSpecUid") ?? "")
  const textSize = String(form.get("textSize") ?? "normal") as TextSize
  const chapterStartsNewPage = form.get("chapterStartsNewPage") !== "false"
  const title = String(form.get("title") ?? "").trim() || "제목 없음"
  const authorName = String(form.get("authorName") ?? "").trim() || "저자 미상"
  const quantity = Math.max(1, Math.min(100, Number(form.get("quantity")) || 1))

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "원고 파일을 올려주세요." }, { status: 400 })
  }
  if (!(textSize in TEXT_SIZES)) {
    return NextResponse.json({ error: "본문 크기 값이 올바르지 않습니다." }, { status: 400 })
  }

  try {
    const specs = await listBookSpecs()
    const spec = specs.find((s) => s.bookSpecUid === specUid) ?? specs[0]
    if (!spec) {
      return NextResponse.json({ error: "판형 정보를 불러오지 못했습니다." }, { status: 502 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const parsed = await parseManuscriptFile(file.name, buffer)
    if (parsed.charCount === 0) {
      return NextResponse.json({ error: "원고에서 본문을 찾지 못했습니다. 파일을 확인해주세요." }, { status: 400 })
    }

    const result = await typeset(parsed.chapters, {
      trimWidthMm: spec.innerTrimWidthMm,
      trimHeightMm: spec.innerTrimHeightMm,
      bleedMm: spec.bleedMm,
      textSize,
      pageIncrement: spec.pageIncrement,
      pageMin: spec.pageMin,
      pageMax: spec.pageMax,
      chapterStartsNewPage,
      title,
      authorName,
    })

    const fit = fitToSpec(parsed.charCount, spec)
    const summary = {
      pageCount: result.pageCount,
      paddedPages: result.paddedPages,
      withinSpec: result.withinSpec,
      notes: [...parsed.notes, ...result.notes],
      manuscript: {
        chapters: parsed.chapters.length,
        paragraphs: parsed.paragraphCount,
        chars: parsed.charCount,
      },
      spec: {
        uid: spec.bookSpecUid,
        name: spec.name,
        pageMin: spec.pageMin,
        pageMax: spec.pageMax,
      },
      // 조판이 끝나야 페이지 수가 확정되고, 그래야 가격이 나온다.
      priceTotal: estimateProductPrice(
        {
          pageMin: spec.pageMin,
          pageIncrement: spec.pageIncrement,
          priceBase: spec.priceBase ?? spec.sandboxPriceBase ?? 0,
          pricePerIncrement: spec.pricePerIncrement ?? spec.sandboxPricePerIncrement ?? 0,
        },
        result.pageCount,
        quantity,
      ),
      quantity,
      sizeOptions: fit.options,
      advice: fit.advice,
    }

    return new NextResponse(new Uint8Array(result.pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="preview-${result.pageCount}p.pdf"`,
        // 한글이 들어가므로 헤더에는 base64로 싣는다.
        "X-Typeset-Summary": Buffer.from(JSON.stringify(summary), "utf8").toString("base64"),
        "Cache-Control": "no-store",
      },
    })
  } catch (e) {
    if (e instanceof SweetBookError) {
      return NextResponse.json({ error: e.errors.join(" ") }, { status: 502 })
    }
    // 지원하지 않는 형식 등은 해결 방법이 담긴 메시지를 그대로 보여준다.
    const msg = e instanceof Error ? e.message : "조판에 실패했습니다."
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
