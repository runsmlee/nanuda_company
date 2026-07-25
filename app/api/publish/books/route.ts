import { NextRequest, NextResponse } from "next/server"
import {
  createBook,
  finalizeBook,
  SweetBookError,
  uploadPdf,
} from "@/lib/publishing/sweetbook"

// 책 생성 → 표지 업로드 → 내지 업로드 → 최종화를 한 번에 처리한다.
// 실패 시 어느 단계(step)에서 왜(errors) 실패했는지 반환해 위저드가 해당 단계를 복구하게 한다.
export async function POST(req: NextRequest) {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 })
  }

  const title = String(form.get("title") ?? "").trim()
  const authorName = String(form.get("authorName") ?? "").trim()
  const bookSpecUid = String(form.get("bookSpecUid") ?? "")
  const pageCount = Number(form.get("pageCount"))
  const attemptId = String(form.get("attemptId") ?? "")
  const cover = form.get("cover")
  const contents = form.get("contents")

  if (!title || title.length > 200) {
    return NextResponse.json({ error: "책 제목을 입력해주세요. (200자 이내)" }, { status: 400 })
  }
  if (!authorName || authorName.length > 100) {
    return NextResponse.json({ error: "저자명을 입력해주세요. (100자 이내)" }, { status: 400 })
  }
  if (!bookSpecUid || !Number.isInteger(pageCount) || pageCount <= 0) {
    return NextResponse.json({ error: "판형과 페이지 수를 확인해주세요." }, { status: 400 })
  }
  if (!(cover instanceof File) || !(contents instanceof File)) {
    return NextResponse.json({ error: "표지와 내지 PDF 파일을 모두 업로드해주세요." }, { status: 400 })
  }
  for (const [label, file] of [["표지", cover], ["내지", contents]] as const) {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: `${label} 파일은 PDF만 업로드할 수 있습니다.` }, { status: 400 })
    }
  }

  // 저자명은 SweetBook 스키마에 없으므로 제목에 병기해 제작 식별에 남긴다.
  const bookTitle = `${title} — ${authorName}`

  let step: "create" | "cover" | "contents" | "finalize" = "create"
  try {
    const { bookUid } = await createBook(
      { title: bookTitle, bookSpecUid, pageCount, externalRef: attemptId || undefined },
      attemptId ? `book-${attemptId}` : undefined,
    )

    step = "cover"
    const coverResult = await uploadPdf(bookUid, "cover", cover)

    step = "contents"
    const contentsResult = await uploadPdf(bookUid, "contents", contents)

    step = "finalize"
    await finalizeBook(bookUid, attemptId ? `final-${attemptId}` : undefined)

    return NextResponse.json({
      bookUid,
      cover: { pdfSizeMm: coverResult.pdfSizeMm, warnings: coverResult.warnings },
      contents: {
        pageCount: contentsResult.pageCount,
        pdfSizeMm: contentsResult.pdfSizeMm,
        warnings: contentsResult.warnings,
      },
    })
  } catch (e) {
    if (e instanceof SweetBookError) {
      return NextResponse.json(
        { step, errorCode: e.errorCode, errors: e.errors },
        { status: e.status >= 500 ? 502 : e.status },
      )
    }
    console.error("publish/books failed at", step, e)
    return NextResponse.json(
      { step, errors: ["제작사 연동 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."] },
      { status: 502 },
    )
  }
}
