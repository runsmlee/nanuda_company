// 결제 완료 → 실제 책 제작 주문.
//
// 조판 PDF를 저장하지 않고 원고 + 옵션에서 다시 만든다. 조판은 결정적이라
// 저자가 미리보기에서 본 것과 같은 결과가 나온다.
//
// 재시도 안전성: 제작사 호출에 우리 주문 UUID를 멱등키로 쓴다. 웹훅이 중간에
// 끊겨 재전송되어도 책과 주문이 두 번 만들어지지 않는다.

import { renderCover } from "./cover"
import { db, getManuscript, type Order, type Project } from "./db"
import { parseManuscriptFile } from "./manuscript"
import {
  createBook,
  createOrder as createPrintOrder,
  finalizeBook,
  getCalculatedSize,
  listBookSpecs,
  uploadPdf,
} from "./sweetbook"
import { typeset } from "./typeset"

export interface FulfillResult {
  printOrderUid: string | null
  status: Order["status"]
  note: string
}

/** File 생성 헬퍼 — 제작사 업로드가 multipart를 요구한다. */
const asFile = (buf: Buffer, name: string) =>
  new File([new Uint8Array(buf)], name, { type: "application/pdf" })

/**
 * 결제된 주문을 제작사에 넣는다.
 * 디지털 주문은 인쇄가 없으므로 상태만 옮긴다.
 */
export async function fulfillOrder(order: Order, project: Project): Promise<FulfillResult> {
  if (order.kind === "digital") {
    await db()
      .from("publishing_orders")
      .update({ status: "submitted", submitted_at: new Date().toISOString() })
      .eq("id", order.id)
    return { printOrderUid: null, status: "submitted", note: "디지털 주문 — 인쇄 없음" }
  }

  const specs = await listBookSpecs()
  const spec = specs.find((s) => s.bookSpecUid === project.book_spec_uid)
  if (!spec) throw new Error(`판형을 찾을 수 없습니다: ${project.book_spec_uid}`)

  // 1) 원고 → 내지 PDF (미리보기와 동일한 입력·옵션)
  const manuscript = await getManuscript(project.manuscript_path)
  const parsed = await parseManuscriptFile(project.manuscript_name, manuscript)
  const inner = await typeset(parsed.chapters, {
    trimWidthMm: spec.innerTrimWidthMm,
    trimHeightMm: spec.innerTrimHeightMm,
    bleedMm: spec.bleedMm,
    textSize: project.text_size,
    pageIncrement: spec.pageIncrement,
    pageMin: spec.pageMin,
    pageMax: spec.pageMax,
    chapterStartsNewPage: project.chapter_new_page,
    title: project.title,
    authorName: project.author_name,
  })

  if (!inner.withinSpec) {
    throw new Error(`조판 결과가 판형 규칙을 벗어났습니다 (${inner.pageCount}쪽).`)
  }
  // 저자가 결제한 시점의 쪽수와 달라지면 가격 근거가 무너진다.
  if (project.page_count && inner.pageCount !== project.page_count) {
    throw new Error(
      `쪽수가 결제 시점(${project.page_count}쪽)과 다릅니다 (${inner.pageCount}쪽). 확인이 필요합니다.`,
    )
  }

  // 2) 표지 PDF — 책등 두께는 확정된 쪽수에서 나온다
  const size = await getCalculatedSize(spec.bookSpecUid, inner.pageCount)
  let coverImage: Buffer | undefined
  if (project.cover_image_path) {
    try {
      coverImage = await getManuscript(project.cover_image_path)
    } catch {
      // 표지 이미지가 없으면 배경색으로 그린다. 인쇄를 막을 이유는 아니다.
    }
  }
  const cover = await renderCover(size, spec.bleedMm, {
    title: project.title,
    authorName: project.author_name,
    publisher: "생각을나누다",
    backText: project.back_text ?? undefined,
    theme: project.cover_theme,
    image: coverImage,
  })

  // 3) 제작사에 제출. 멱등키는 우리 주문 UUID.
  const { bookUid } = await createBook(
    {
      title: `${project.title} — ${project.author_name}`,
      bookSpecUid: spec.bookSpecUid,
      pageCount: inner.pageCount,
      externalRef: order.id,
    },
    `book-${order.id}`,
  )

  await uploadPdf(bookUid, "cover", asFile(cover.pdf, "cover.pdf"))
  await uploadPdf(bookUid, "contents", asFile(inner.pdf, "contents.pdf"))
  await finalizeBook(bookUid, `final-${order.id}`)

  const printOrder = await createPrintOrder(
    {
      items: [{ bookUid, quantity: order.quantity }],
      shipping: {
        recipientName: order.recipient_name ?? "",
        recipientPhone: order.recipient_phone ?? "",
        postalCode: order.postal_code ?? "",
        address1: order.address1 ?? "",
        address2: order.address2 ?? undefined,
        memo: order.shipping_memo ?? undefined,
      },
      externalRef: order.id,
    },
    `order-${order.id}`,
  )

  await db()
    .from("publishing_orders")
    .update({
      status: "submitted",
      print_order_uid: printOrder.orderUid,
      print_status: printOrder.orderStatus,
      submitted_at: new Date().toISOString(),
    })
    .eq("id", order.id)

  return {
    printOrderUid: printOrder.orderUid,
    status: "submitted",
    note: `${inner.pageCount}쪽 · ${order.quantity}권 제작 접수`,
  }
}

/** 실패를 기록해 운영자가 개입할 수 있게 한다. 결제는 이미 끝났으므로 조용히 삼키면 안 된다. */
export async function markOrderFailed(orderId: string, reason: string) {
  await db()
    .from("publishing_orders")
    .update({ status: "failed", failure_reason: reason.slice(0, 500) })
    .eq("id", orderId)
}
