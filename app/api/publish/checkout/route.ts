import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "node:crypto"
import { PUBLISH_ENABLED } from "@/lib/publishing/config"
import { db, putManuscript } from "@/lib/publishing/db"
import { parseManuscriptFile } from "@/lib/publishing/manuscript"
import { getPaymentProvider, PaymentError, type LineKind } from "@/lib/publishing/payment"
import { estimateProductPrice } from "@/lib/publishing/pricing"
import { listBookSpecs } from "@/lib/publishing/sweetbook"
import { typeset, type TextSize } from "@/lib/publishing/typeset"
import { SITE_URL } from "@/lib/site-config"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * 원고와 옵션을 저장하고 결제 페이지를 만든다.
 *
 * 가격은 반드시 서버에서 다시 조판해 확정한다. 클라이언트가 보낸 쪽수·금액을
 * 믿으면 값을 조작해 헐값에 책을 만들 수 있다.
 */
export async function POST(req: NextRequest) {
  if (!PUBLISH_ENABLED) {
    return NextResponse.json({ error: "현재 주문을 받고 있지 않습니다." }, { status: 503 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 })
  }

  const file = form.get("manuscript")
  const kind = String(form.get("kind") ?? "digital") as LineKind
  const email = String(form.get("email") ?? "").trim()
  const title = String(form.get("title") ?? "").trim() || "제목 없음"
  const authorName = String(form.get("authorName") ?? "").trim() || "저자 미상"
  const specUid = String(form.get("bookSpecUid") ?? "")
  const textSize = String(form.get("textSize") ?? "normal") as TextSize
  const chapterNewPage = form.get("chapterStartsNewPage") !== "false"
  const coverTheme = String(form.get("coverTheme") ?? "ivory") as "ivory" | "charcoal" | "photo"
  const backText = String(form.get("backText") ?? "").slice(0, 600)
  const quantity = Math.max(1, Math.min(100, Number(form.get("quantity")) || 1))

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "원고 파일이 필요합니다." }, { status: 400 })
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "연락받을 이메일을 확인해주세요." }, { status: 400 })
  }
  if (kind !== "digital" && kind !== "physical") {
    return NextResponse.json({ error: "주문 종류가 올바르지 않습니다." }, { status: 400 })
  }

  // 실물 주문은 배송지를 서버에서 다시 검증한다.
  const shipping = {
    recipient_name: String(form.get("recipientName") ?? "").trim(),
    recipient_phone: String(form.get("recipientPhone") ?? "").trim(),
    postal_code: String(form.get("postalCode") ?? "").trim(),
    address1: String(form.get("address1") ?? "").trim(),
    address2: String(form.get("address2") ?? "").trim() || null,
    shipping_memo: String(form.get("shippingMemo") ?? "").trim() || null,
  }
  if (kind === "physical") {
    if (!shipping.recipient_name) return NextResponse.json({ error: "받는 분 성함을 입력해주세요." }, { status: 400 })
    if (!/^[0-9+\-\s]{9,20}$/.test(shipping.recipient_phone)) {
      return NextResponse.json({ error: "연락처를 확인해주세요." }, { status: 400 })
    }
    if (!/^\d{5}$/.test(shipping.postal_code)) {
      return NextResponse.json({ error: "우편번호 5자리를 입력해주세요." }, { status: 400 })
    }
    if (!shipping.address1) return NextResponse.json({ error: "주소를 입력해주세요." }, { status: 400 })
  }

  try {
    const specs = await listBookSpecs()
    const spec = specs.find((s) => s.bookSpecUid === specUid) ?? specs[0]
    if (!spec) return NextResponse.json({ error: "판형 정보를 불러오지 못했습니다." }, { status: 502 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const parsed = await parseManuscriptFile(file.name, buffer)
    if (parsed.charCount === 0) {
      return NextResponse.json({ error: "원고에서 본문을 찾지 못했습니다." }, { status: 400 })
    }

    // 서버에서 조판해 쪽수를 확정한다 — 가격의 유일한 근거.
    const inner = await typeset(parsed.chapters, {
      trimWidthMm: spec.innerTrimWidthMm,
      trimHeightMm: spec.innerTrimHeightMm,
      bleedMm: spec.bleedMm,
      textSize,
      pageIncrement: spec.pageIncrement,
      pageMin: spec.pageMin,
      pageMax: spec.pageMax,
      chapterStartsNewPage: chapterNewPage,
      title,
      authorName,
    })
    if (!inner.withinSpec) {
      return NextResponse.json(
        { error: `이 판형으로는 제작할 수 없습니다 (${inner.pageCount}쪽). 본문 크기나 판형을 바꿔주세요.` },
        { status: 400 },
      )
    }

    const price =
      kind === "physical"
        ? estimateProductPrice(
            {
              pageMin: spec.pageMin,
              pageIncrement: spec.pageIncrement,
              priceBase: spec.priceBase ?? spec.sandboxPriceBase ?? 0,
              pricePerIncrement: spec.pricePerIncrement ?? spec.sandboxPricePerIncrement ?? 0,
            },
            inner.pageCount,
            quantity,
          )
        : Number(process.env.PUBLISHING_DIGITAL_PRICE_KRW ?? 19000)

    const projectId = crypto.randomUUID()
    const manuscriptPath = await putManuscript(projectId, file.name, buffer)

    const { error: pErr } = await db().from("publishing_projects").insert({
      id: projectId,
      author_email: email,
      access_token: randomBytes(24).toString("base64url"),
      title,
      author_name: authorName,
      manuscript_path: manuscriptPath,
      manuscript_name: file.name,
      book_spec_uid: spec.bookSpecUid,
      text_size: textSize,
      chapter_new_page: chapterNewPage,
      cover_theme: coverTheme,
      back_text: backText || null,
      page_count: inner.pageCount,
      char_count: parsed.charCount,
    })
    if (pErr) throw new Error(`프로젝트 저장 실패: ${pErr.message}`)

    const { data: order, error: oErr } = await db()
      .from("publishing_orders")
      .insert({
        project_id: projectId,
        kind,
        quantity: kind === "physical" ? quantity : 1,
        price_krw: price,
        ...(kind === "physical" ? shipping : {}),
      })
      .select("id")
      .single()
    if (oErr || !order) throw new Error(`주문 생성 실패: ${oErr?.message}`)

    const variantId =
      kind === "physical"
        ? process.env.LEMONSQUEEZY_VARIANT_PHYSICAL
        : process.env.LEMONSQUEEZY_VARIANT_DIGITAL
    if (!variantId) {
      return NextResponse.json({ error: "결제 상품이 설정되지 않았습니다." }, { status: 503 })
    }

    const checkout = await getPaymentProvider().createCheckout({
      lines: [
        {
          kind,
          variantId,
          name: kind === "physical" ? `${title} — 실물 책 ${quantity}권` : `${title} — 인쇄용 PDF`,
          priceKrw: price,
          quantity: 1,
        },
      ],
      reference: order.id,
      email,
      successUrl: `${SITE_URL}/publish/orders/done?ref=${order.id}`,
    })

    return NextResponse.json({
      checkoutUrl: checkout.url,
      orderId: order.id,
      pageCount: inner.pageCount,
      priceKrw: price,
    })
  } catch (e) {
    if (e instanceof PaymentError) {
      return NextResponse.json({ error: e.detail }, { status: e.status >= 500 ? 502 : e.status })
    }
    const msg = e instanceof Error ? e.message : "주문 준비에 실패했습니다."
    console.error("[publish/checkout]", msg)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
