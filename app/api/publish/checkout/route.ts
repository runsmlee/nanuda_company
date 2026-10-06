import { NextRequest, NextResponse } from "next/server"
import { randomBytes, createHash } from "node:crypto"
import { PUBLISH_ENABLED } from "@/lib/publishing/config"
import { db, putManuscript, type Order, type Project } from "@/lib/publishing/db"
import { parseManuscriptFile } from "@/lib/publishing/manuscript"
import { getPaymentProvider, PaymentError, assertPaymentEnvironment, paymentTestMode, type LineKind } from "@/lib/publishing/payment"
import { estimateDeliveredPrice } from "@/lib/publishing/pricing"
import { renderCover } from "@/lib/publishing/cover"
import { listBookSpecs, getCalculatedSize } from "@/lib/publishing/sweetbook"
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

  if (Number(req.headers.get("content-length")) > 4_500_000) return NextResponse.json({ error: "원고와 표지는 합계 4MB 이내로 올려주세요." }, { status: 413 })

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 })
  }

  const file = form.get("manuscript")
  const coverImage = form.get("coverImage")
  const kind: LineKind = "physical"
  const email = String(form.get("email") ?? "").trim()
  const title = String(form.get("title") ?? "").trim() || "제목 없음"
  const authorName = String(form.get("authorName") ?? "").trim() || "저자 미상"
  const specUid = String(form.get("bookSpecUid") ?? "")
  const textSize = String(form.get("textSize") ?? "normal") as TextSize
  const chapterNewPage = form.get("chapterStartsNewPage") !== "false"
  const coverTheme = String(form.get("coverTheme") ?? "ivory") as "ivory" | "charcoal" | "photo"
  const backText = String(form.get("backText") ?? "").slice(0, 600)
  const quantity = Number(form.get("quantity"))
  const attemptId = String(form.get("attemptId") ?? "")
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(attemptId)) {
    return NextResponse.json({ error: "주문 요청을 새로 시작해주세요." }, { status: 400 })
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100
    || !["small", "normal", "large"].includes(textSize)
    || !["ivory", "charcoal", "photo"].includes(coverTheme)
    || title.length > 100 || authorName.length > 100 || email.length > 254
    || String(form.get("backText") ?? "").length > 600) {
    return NextResponse.json({ error: "제작 옵션과 입력 길이를 확인해주세요." }, { status: 400 })
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "원고 파일이 필요합니다." }, { status: 400 })
  }
  if (file.size === 0 || file.size > 3 * 1024 * 1024 || !/\.(docx|md|txt)$/i.test(file.name)
    || (coverImage instanceof File && (coverImage.size > 1024 * 1024 || !/^image\/(jpeg|png)$/.test(coverImage.type)))) {
    return NextResponse.json({ error: "원고는 3MB, JPG·PNG 표지는 1MB 이내로 올려주세요." }, { status: 400 })
  }
  if (coverTheme === "photo" && (!(coverImage instanceof File) || coverImage.size === 0)) {
    return NextResponse.json({ error: "사진 표지에 사용할 JPG·PNG 이미지를 올려주세요." }, { status: 400 })
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "연락받을 이메일을 확인해주세요." }, { status: 400 })
  }

  // 판매 대상은 실물 책 제작이다. PDF는 조판 과정에서만 쓰인다.
  const shipping = {
    recipient_name: String(form.get("recipientName") ?? "").trim(),
    recipient_phone: String(form.get("recipientPhone") ?? "").trim(),
    postal_code: String(form.get("postalCode") ?? "").trim(),
    address1: String(form.get("address1") ?? "").trim(),
    address2: String(form.get("address2") ?? "").trim() || null,
    shipping_memo: String(form.get("shippingMemo") ?? "").trim() || null,
  }
  if (!shipping.recipient_name) return NextResponse.json({ error: "받는 분 성함을 입력해주세요." }, { status: 400 })
  if (!/^[0-9+\-\s]{9,20}$/.test(shipping.recipient_phone)) {
    return NextResponse.json({ error: "연락처를 확인해주세요." }, { status: 400 })
  }
  if (!/^\d{5}$/.test(shipping.postal_code)) {
    return NextResponse.json({ error: "우편번호 5자리를 입력해주세요." }, { status: 400 })
  }
  if (shipping.recipient_name.length > 100 || shipping.address1.length > 200
    || (shipping.address2?.length ?? 0) > 200 || (shipping.shipping_memo?.length ?? 0) > 200) {
    return NextResponse.json({ error: "배송지 입력 길이를 확인해주세요." }, { status: 400 })
  }
  if (!shipping.address1) return NextResponse.json({ error: "주소를 입력해주세요." }, { status: 400 })

  let savedOrderId: string | undefined
  let savedToken: string | undefined
  let checkoutLease: string | undefined
  try {
    if (!process.env.PUBLISH_WORKER_SECRET || process.env.PUBLISH_WORKER_SECRET.length < 32) throw new PaymentError(503, "현재 주문 접수를 준비 중입니다.")
    const provider = getPaymentProvider()
    const variantId = process.env.LEMONSQUEEZY_VARIANT_ID ?? process.env.LEMONSQUEEZY_VARIANT_PHYSICAL
    if (!variantId || !/^\d+$/.test(variantId)) throw new PaymentError(503, "결제 상품이 설정되지 않았습니다.")
    const testMode = paymentTestMode()
    assertPaymentEnvironment(testMode)
    const specs = await listBookSpecs()
    const spec = specs.find((s) => s.bookSpecUid === specUid)
    if (!spec) return NextResponse.json({ error: "선택한 판형을 확인해주세요." }, { status: 400 })

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

    const price = estimateDeliveredPrice(
      {
        pageMin: spec.pageMin,
        pageIncrement: spec.pageIncrement,
        priceBase: spec.priceBase ?? spec.sandboxPriceBase ?? 0,
        pricePerIncrement: spec.pricePerIncrement ?? spec.sandboxPricePerIncrement ?? 0,
      },
      inner.pageCount,
      quantity,
    )

    const hash = createHash("sha256").update(buffer)
    const fields = [email, title, authorName, specUid, textSize, chapterNewPage, coverTheme, backText, quantity, shipping]
    hash.update(JSON.stringify(fields))
    hash.update(file.name)
    let coverBuf: Buffer | undefined
    if (coverImage instanceof File && coverImage.size > 0) {
      coverBuf = Buffer.from(await coverImage.arrayBuffer())
      hash.update(coverBuf)
    }
    if (coverTheme === "photo") {
      const size = await getCalculatedSize(spec.bookSpecUid, inner.pageCount)
      try {
        await renderCover(size, spec.bleedMm, {
          title, authorName, publisher: "생각을나누다", backText, theme: coverTheme,
          image: coverBuf, strictImage: true,
        })
      } catch {
        return NextResponse.json({ error: "표지 이미지를 읽지 못했습니다. JPG·PNG 파일을 확인해주세요." }, { status: 400 })
      }
    }
    const requestHash = hash.digest("hex")
    const projectId = attemptId
    const { data: existing, error: lookupError } = await db().from("publishing_projects")
      .select("*").eq("id", projectId).maybeSingle<Project & { request_hash: string }>()
    if (lookupError) throw new Error("프로젝트 조회 실패")
    if (existing && existing.request_hash !== requestHash) {
      return NextResponse.json({ error: "입력이 변경되었습니다. 주문 요청을 새로 시작해주세요.", restart: true }, { status: 409 })
    }
    let project = existing
    if (!project) {
      const manuscriptPath = await putManuscript(projectId, file.name, buffer)
      const coverImagePath = coverBuf && coverImage instanceof File
        ? await putManuscript(projectId, coverImage.name, coverBuf) : null
      const { error: pErr } = await db().from("publishing_projects").insert({
        id: projectId, request_hash: requestHash, author_email: email,
        access_token: randomBytes(24).toString("base64url"), title, author_name: authorName,
        manuscript_path: manuscriptPath, manuscript_name: file.name, book_spec_uid: spec.bookSpecUid,
        text_size: textSize, chapter_new_page: chapterNewPage, cover_theme: coverTheme,
        cover_image_path: coverImagePath, back_text: backText || null,
        page_count: inner.pageCount, char_count: parsed.charCount,
      })
      if (pErr && pErr.code !== "23505") throw new Error("프로젝트 저장 실패")
      const { data, error } = await db().from("publishing_projects").select("*").eq("id", projectId)
        .single<Project & { request_hash: string }>()
      if (error || !data || data.request_hash !== requestHash) throw new Error("주문 요청 충돌")
      project = data
    }
    savedToken = project.access_token
    const { error: oErr } = await db().from("publishing_orders").insert({
      id: attemptId, project_id: projectId, request_hash: requestHash, kind, quantity, price_krw: price,
      expected_store_id: process.env.LEMONSQUEEZY_STORE_ID, expected_variant_id: variantId,
      payment_test_mode: testMode, ...shipping,
    })
    if (oErr && oErr.code !== "23505") throw new Error("주문 생성 실패")
    const { data: order, error: orderError } = await db().from("publishing_orders").select("*")
      .eq("id", attemptId).single<Order>()
    if (orderError || !order || order.request_hash !== requestHash) throw new Error("주문 조회 실패")
    savedOrderId = order.id
    const orderUrl = `/publish/orders/done?ref=${order.id}&token=${savedToken}`
    const reply = (checkoutUrl: string) => NextResponse.json({ checkoutUrl, orderId: order.id, orderUrl,
      pageCount: project.page_count, priceKrw: order.price_krw })
    if (order.status !== "pending") {
      return NextResponse.json({ error: "기존 주문의 결제·제작 상태를 먼저 확인해주세요.", orderUrl, orderId: order.id }, { status: 409 })
    }
    if (order.checkout_url && order.checkout_expires_at && Date.parse(order.checkout_expires_at) > Date.now()) {
      return reply(order.checkout_url)
    }
    if (order.checkout_expires_at) {
      return NextResponse.json({ error: "결제 링크가 만료되었습니다. 새 주문을 시작해주세요.", orderUrl, restart: true }, { status: 409 })
    }
    const now = new Date().toISOString()
    const leaseToken = crypto.randomUUID()
    const { data: lease, error: leaseError } = await db().from("publishing_orders")
      .update({ checkout_lease_token: leaseToken, checkout_lease_until: new Date(Date.now() + 90_000).toISOString() }).eq("id", order.id)
      .is("checkout_url", null).or(`checkout_lease_until.is.null,checkout_lease_until.lt.${now}`)
      .select("id").maybeSingle()
    if (leaseError) throw new Error("결제 준비 기록 실패")
    if (!lease) return NextResponse.json({ error: "동일한 주문을 준비 중입니다. 잠시 후 다시 확인해주세요.", orderUrl }, { status: 409 })

    checkoutLease = leaseToken
    const checkout = await provider.createCheckout({
      lines: [
        {
          kind,
          variantId,
          name: `${title} — 책 제작 ${quantity}권`,
          priceKrw: order.price_krw,
          quantity: 1,
        },
      ],
      reference: order.id,
      email,
      successUrl: `${SITE_URL}${orderUrl}`,
    })

    const { error: checkoutError } = await db().from("publishing_orders").update({
      checkout_url: checkout.url, checkout_id: checkout.providerCheckoutId,
      checkout_expires_at: checkout.expiresAt, checkout_lease_until: null, checkout_lease_token: null,
    }).eq("id", order.id).eq("checkout_lease_token", leaseToken).select("id").single()
    if (checkoutError) throw new Error("결제 링크 저장 실패")
    return reply(checkout.url)
  } catch (e) {
    if (savedOrderId && checkoutLease) {
      const { error } = await db().from("publishing_orders").update({ checkout_lease_token: null, checkout_lease_until: null }).eq("id", savedOrderId).eq("checkout_lease_token", checkoutLease)
      if (error) console.error("[publish/checkout] lease release failed")
    }
    const recovery = savedOrderId && savedToken ? {
      orderId: savedOrderId, orderUrl: `/publish/orders/done?ref=${savedOrderId}&token=${savedToken}`,
    } : {}
    if (e instanceof PaymentError) {
      return NextResponse.json({ error: e.detail, ...recovery }, { status: e.status >= 500 ? 502 : e.status })
    }
    const msg = e instanceof Error ? e.message : "주문 준비에 실패했습니다."
    console.error("[publish/checkout]", msg)
    return NextResponse.json({ error: "주문 준비에 실패했습니다. 잠시 후 다시 시도해주세요.", ...recovery }, { status: 502 })
  }
}
