// 결제 완료 → 실제 책 제작 주문.
//
// 조판 PDF를 저장하지 않고 원고 + 옵션에서 다시 만든다. 조판은 결정적이라
// 저자가 미리보기에서 본 것과 같은 결과가 나온다.
//
// 재시도 안전성: 제작사 호출에 우리 주문 UUID를 멱등키로 쓴다. 웹훅이 중간에
// 끊겨 재전송되어도 책과 주문이 두 번 만들어지지 않는다.

import { renderCover } from "./cover"
import { db, currentWork, getManuscript, type Order, type Project } from "./db"
import { parseManuscriptFile } from "./manuscript"
import {
  createBook,
  getBook,
  estimateOrder,
  createOrder as createPrintOrder,
  finalizeBook,
  getCalculatedSize,
  listBookSpecs,
  uploadPdf,
  SweetBookError,
  type OrderRequest,
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
 * 판매 대상은 실물 책이다. digital은 예전 행을 막기 위한 안전장치일 뿐이다.
 */
export async function fulfillOrder(order: Order, project: Project): Promise<FulfillResult> {
  if (order.kind !== "physical") throw new Error("Unsupported fulfillment kind")

  if (order.print_request) return submitPrintRequest(order, order.print_request)

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
    coverImage = await getManuscript(project.cover_image_path)
  }
  const cover = await renderCover(size, spec.bleedMm, {
    title: project.title,
    authorName: project.author_name,
    publisher: "생각을나누다",
    backText: project.back_text ?? undefined,
    theme: project.cover_theme,
    image: coverImage,
    strictImage: true,
  })

  // 3) 제작사에 제출. 멱등키는 우리 주문 UUID.
  let bookUid = order.book_uid
  if (!bookUid) {
    const created = await createBook({
      title: `${project.title} — ${project.author_name}`, bookSpecUid: spec.bookSpecUid,
      pageCount: inner.pageCount, externalRef: order.id,
    }, `book-${order.id}`)
    bookUid = created.bookUid
    const { error } = await db().from("publishing_orders").update({ book_uid: bookUid })
      .eq("id", order.id).eq("fulfillment_token", order.fulfillment_token!).select("id").single()
    if (error) throw new Error("Book identity recording failed")
  }
  const book = await getBook(bookUid)
  if (book.bookStatus !== 2) {
    await uploadPdf(bookUid, "cover", asFile(cover.pdf, "cover.pdf"))
    await uploadPdf(bookUid, "contents", asFile(inner.pdf, "contents.pdf"))
    await finalizeBook(bookUid, `final-${order.id}`)
  }

  const request = {
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
    }
  const estimate = await estimateOrder(request)
  if (!Number.isFinite(estimate.paidCreditAmount) || estimate.paidCreditAmount > order.price_krw) {
    throw new SweetBookError(422, "ERR_QUOTE_CHANGED", [], "Supplier quote requires review")
  }
  const { data: prepared, error: prepareError } = await db().from("publishing_orders")
    .update({ print_request: request, print_requested_at: new Date().toISOString() }).eq("id", order.id).eq("fulfillment_token", order.fulfillment_token!)
    .in("status", ["paid", "failed"]).eq("review_required", false)
    .gt("fulfillment_until", new Date().toISOString()).select("*").maybeSingle<Order>()
  if (prepareError) throw new Error("Print intent recording failed")
  if (!prepared) {
    const current = await currentWork(order)
    return { printOrderUid: null, status: current.status, note: "Payment hold: no print order created" }
  }
  return submitPrintRequest(prepared, request)
}

/** Persisted intent + supplier idempotency recover even a lost createOrder/DB response during refund. */
export async function submitPrintRequest(order: Order, request: OrderRequest): Promise<FulfillResult> {
  const current = await currentWork(order)
  if (current.status === "cancelled" || (current.review_required && current.status !== "refunded")) {
    return { printOrderUid: null, status: current.status, note: "Payment hold: no print order created" }
  }
  // SweetBook idempotency records expire after 24h. An ambiguous old request requires operator reconciliation.
  if (!current.print_requested_at || Date.now() - Date.parse(current.print_requested_at) > 23 * 60 * 60 * 1000) {
    throw new SweetBookError(422, "ERR_OLD_INTENT", [], "Print request is outside the idempotency recovery window")
  }
  const printOrder = await createPrintOrder(request, `order-${order.id}`)
  const { data, error } = await db().rpc("publishing_attach_print", {
    p_order_id: order.id, p_token: order.fulfillment_token,
    p_print_uid: printOrder.orderUid, p_status: printOrder.orderStatus,
  })
  if (error || !data?.length) throw new Error("Print order recording failed")
  return { printOrderUid: printOrder.orderUid, status: data[0].status, note: "제작 접수 확인" }
}
