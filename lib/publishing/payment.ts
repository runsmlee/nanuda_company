// 결제 어댑터.
//
// 레몬스퀴지로 시작하되 결제사에 코드를 결합하지 않는다. 주문 항목에
// digital/physical 구분을 처음부터 두어, 나중에 실물만 국내 PG로 떼어내거나
// Stripe Managed Payments로 옮기는 것이 설정 변경 수준이 되게 한다.
//
// 배경(docs/self-publishing-service-design.md): 모든 MoR이 약관상 실물 상품을
// 금지하며, 레몬스퀴지는 Stripe 인수 후 유지보수 모드다. 전환은 '언제'의 문제다.

import { createHmac, timingSafeEqual } from "node:crypto"
import { impliedChargeMinor, nextSendKrw, sendKrwForCeiling } from "./webhook-guard"

/** 결제 항목의 성격. 결제사 이전 시 이 값으로 라우팅한다. */
export type LineKind = "digital" | "physical"

export interface CheckoutLine {
  kind: LineKind
  /** 결제사에 등록된 상품 식별자 (레몬스퀴지는 variantId). */
  variantId: string
  name: string
  priceKrw: number
  quantity: number
}

export interface CheckoutInput {
  lines: CheckoutLine[]
  /** 우리 쪽 주문 식별자. 웹훅에서 이 값으로 주문을 되찾는다. */
  reference: string
  email?: string
  /** 결제 후 돌아올 주소. */
  successUrl: string
}

export interface PaymentEvent {
  type: "paid" | "refunded" | "other"
  /** 결제사 주문 ID. 중복 처리 방지의 기준이 된다. */
  providerOrderId: string
  /** createCheckout에 넣었던 reference. */
  reference: string | null
  email: string | null
  totalMinor: number
  currency: string
  testMode: boolean
  rawEventName: string
  storeId: string
  variantId: string
  refundedMinor: number
  fullyRefunded?: boolean
}

export interface PaymentProvider {
  readonly name: string
  createCheckout(input: CheckoutInput): Promise<{ url: string; providerCheckoutId: string; expiresAt: string }>
  verifyWebhook(rawBody: string, signature: string | null): boolean
  getOrderEvent(providerOrderId: string, reference: string): Promise<PaymentEvent>
  checkConfiguration(): Promise<void>
  parseEvent(rawBody: string, eventName: string | null): PaymentEvent
}

export class PaymentError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(detail)
    this.name = "PaymentError"
  }
}

const LS_API = "https://api.lemonsqueezy.com/v1"

export class LemonSqueezyProvider implements PaymentProvider {
  readonly name = "lemonsqueezy"

  constructor(
    private apiKey: string,
    private storeId: string,
    private webhookSecret: string,
    /**
     * 스토어 통화. 레몬스퀴지 `custom_price`는 문서상 항상 cents다.
     * 원화 스토어에서도 26,800원을 26800으로 보내면 ₩268로 읽힌다. KRW는 원 × 100.
     * 스토어가 USD면 원화 금액을 넣을 수 없으므로 결제를 만들지 않는다.
     */
    private storeCurrency: string,
  ) {}

  /** Read-only deployment check: use server credentials without creating a checkout. */
  async checkConfiguration() {
    const variantId = process.env.LEMONSQUEEZY_VARIANT_ID
    if (!variantId) throw new PaymentError(503, "결제 상품 설정이 없습니다.")
    const read = async (path: string) => {
      const res = await fetch(`${LS_API}${path}`, { cache: "no-store", signal: AbortSignal.timeout(15000),
        headers: { Accept: "application/vnd.api+json", Authorization: `Bearer ${this.apiKey}` } })
      if (!res.ok) throw new PaymentError(503, `결제 설정 조회 실패 (${res.status})`)
      return (await res.json())?.data
    }
    const [store, variant] = await Promise.all([read(`/stores/${encodeURIComponent(this.storeId)}`), read(`/variants/${encodeURIComponent(variantId)}`)])
    if (store?.attributes?.currency !== "KRW" || this.storeCurrency !== "KRW")
      throw new PaymentError(503, "결제 스토어와 서버 통화를 KRW로 맞춰야 합니다.")
    if (variant?.attributes?.test_mode !== paymentTestMode())
      throw new PaymentError(503, "결제 상품과 서버의 테스트/라이브 모드가 다릅니다.")
    if (!paymentTestMode() && variant?.attributes?.status !== "published")
      throw new PaymentError(503, "운영 결제 상품이 published 상태가 아닙니다.")
  }

  /**
   * 레몬스퀴지 체크아웃은 variant 하나만 받는다. 여러 줄이 필요하면
   * 결제를 나누거나 묶음 variant를 만들어야 한다 — 지금은 첫 줄만 쓰고,
   * 여러 줄이 들어오면 명시적으로 막는다.
   */
  async createCheckout(input: CheckoutInput) {
    if (input.lines.length !== 1) {
      throw new PaymentError(400, "레몬스퀴지 체크아웃은 항목 하나만 지원합니다.")
    }
    // 통화가 어긋나면 조용히 과청구된다. 만들지 않고 멈추는 편이 낫다.
    if (this.storeCurrency !== "KRW") {
      throw new PaymentError(
        503,
        `결제 스토어 통화가 ${this.storeCurrency}입니다. 원화 가격을 그대로 보내면 과청구되므로 결제를 만들지 않았습니다.`,
      )
    }
    const line = input.lines[0]
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const listedKrw = Math.round(line.priceKrw)
    let sendKrw = listedKrw

    // 표시가는 천장. 환전 때문에 미리보기 총액이 더 나오면 넣는 금액을 낮춘다.
    for (let attempt = 0; attempt < 5; attempt++) {
      const body = await this.postCheckout(input, line, sendKrw, expiresAt)
      const preview = body?.data?.attributes?.preview
      const previewCharge = impliedChargeMinor(preview ?? {})
      if (!Number.isFinite(previewCharge) || previewCharge <= 0) {
        throw new PaymentError(502, "결제 미리보기 금액을 확인하지 못했습니다.")
      }
      const next = nextSendKrw(listedKrw, sendKrw, previewCharge)
      if (next === null) {
        if (body.data.attributes.test_mode !== paymentTestMode() || !body.data.id) throw new PaymentError(502, "결제 환경을 확인하지 못했습니다.")
        return {
          url: safeCheckoutUrl(body.data.attributes.url),
          providerCheckoutId: String(body.data.id),
          expiresAt,
        }
      }
      const rate = Number(preview?.currency_rate)
      const fitted = rate > 0 ? sendKrwForCeiling(listedKrw, rate) : next
      sendKrw = fitted < sendKrw ? fitted : sendKrw - 10
      if (sendKrw < 1) {
        throw new PaymentError(502, "표시 금액 이하로 결제 페이지를 만들지 못했습니다.")
      }
    }
    throw new PaymentError(502, "표시 금액 이하로 결제 페이지를 만들지 못했습니다.")
  }

  private async postCheckout(input: CheckoutInput, line: CheckoutLine, sendKrw: number, expiresAt: string) {
    const res = await fetch(`${LS_API}/checkouts`, {
      method: "POST",
      signal: AbortSignal.timeout(15000),
      headers: {
        Accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        data: {
          type: "checkouts",
          attributes: {
            // 레몬스퀴지는 KRW여도 cents. 26,800원 → 2680000.
            custom_price: sendKrw * 100,
            preview: true,
            test_mode: paymentTestMode(),
            expires_at: expiresAt,
            checkout_options: { discount: false },
            product_options: {
              name: line.name,
              redirect_url: input.successUrl,
              enabled_variants: [Number(line.variantId)],
              receipt_link_url: input.successUrl,
              receipt_button_text: "주문 진행 확인",
            },
            checkout_data: {
              email: input.email,
              billing_address: { country: "KR" },
              variant_quantities: [{ variant_id: Number(line.variantId), quantity: 1 }],
              // 웹훅 meta.custom_data로 그대로 돌아온다.
              custom: { reference: input.reference, kind: line.kind },
            },
          },
          relationships: {
            store: { data: { type: "stores", id: String(this.storeId) } },
            variant: { data: { type: "variants", id: String(line.variantId) } },
          },
        },
      }),
    })

    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      const detail = body?.errors?.[0]?.detail ?? "결제 페이지를 만들지 못했습니다."
      throw new PaymentError(res.status, detail)
    }
    return body
  }

  async getOrderEvent(providerOrderId: string, reference: string): Promise<PaymentEvent> {
    const res = await fetch(`${LS_API}/orders/${encodeURIComponent(providerOrderId)}`, {
      headers: { Accept: "application/vnd.api+json", Authorization: `Bearer ${this.apiKey}` },
      cache: "no-store", signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new PaymentError(res.status, "결제 내역 조회 실패")
    const body = await res.json()
    const attrs = body?.data?.attributes
    if (!attrs || String(body.data.id) !== providerOrderId) throw new PaymentError(502, "결제 내역 확인 실패")
    const eventName = Number(attrs.refunded_amount) > 0 || attrs.refunded === true ? "order_refunded" : "order_created"
    const event = this.parseEvent(JSON.stringify({ ...body, meta: { event_name: eventName, custom_data: { reference } } }), eventName)
    if (event.type === "other") throw new PaymentError(409, "결제 상태 확인이 필요합니다.")
    return event
  }

  /**
   * HMAC-SHA256 hex digest를 X-Signature와 비교한다.
   * 반드시 원문(raw body) 그대로 계산해야 한다. JSON 파싱 후 재직렬화하면 어긋난다.
   */
  verifyWebhook(rawBody: string, signature: string | null): boolean {
    if (!signature) return false
    const digest = Buffer.from(
      createHmac("sha256", this.webhookSecret).update(rawBody, "utf8").digest("hex"),
      "utf8",
    )
    const given = Buffer.from(signature, "utf8")
    // 길이가 다르면 timingSafeEqual이 예외를 던지므로 먼저 확인한다.
    if (digest.length !== given.length) return false
    return timingSafeEqual(digest, given)
  }

  parseEvent(rawBody: string, eventName: string | null): PaymentEvent {
    const body = JSON.parse(rawBody)
    const attrs = body?.data?.attributes ?? {}
    const custom = body?.meta?.custom_data ?? {}
    const name = body?.meta?.event_name ?? ""
    if (typeof name !== "string" || (eventName && eventName !== name)) throw new Error("event name mismatch")

    const mode = attrs.test_mode ?? attrs.first_order_item?.test_mode
    if (["order_created", "order_refunded"].includes(name) && (typeof mode !== "boolean"
      || (attrs.test_mode !== undefined && attrs.first_order_item?.test_mode !== undefined
        && attrs.test_mode !== attrs.first_order_item.test_mode))) throw new Error("Invalid payment mode")
    let type: PaymentEvent["type"] = "other"
    if (name === "order_created" && attrs.status === "paid") type = "paid"
    else if (name === "order_refunded" || (name === "order_created" && attrs.refunded === true)) type = "refunded"

    return {
      type,
      providerOrderId: String(body?.data?.id ?? ""),
      reference: custom.reference ? String(custom.reference) : null,
      email: attrs.user_email ? String(attrs.user_email) : null,
      totalMinor: Number(attrs.total ?? 0),
      currency: String(attrs.currency ?? ""),
      testMode: mode === true,
      rawEventName: name,
      storeId: String(attrs.store_id ?? ""),
      variantId: String(attrs.first_order_item?.variant_id ?? ""),
      refundedMinor: Number(attrs.refunded_amount ?? 0),
      fullyRefunded: attrs.refunded === true,
    }
  }
}

/** 환경변수에서 결제사를 만든다. 설정이 없으면 명확히 알린다. */
export function getPaymentProvider(): PaymentProvider {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY
  const storeId = process.env.LEMONSQUEEZY_STORE_ID
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET
  // 스토어 통화는 명시적으로 받는다. 기본값을 KRW로 두면 USD 스토어에서
  // 과청구가 조용히 지나간다.
  const currency = process.env.LEMONSQUEEZY_STORE_CURRENCY
  if (!apiKey || !storeId || !secret || !currency) {
    throw new PaymentError(500, "결제 설정이 완료되지 않았습니다.")
  }
  return new LemonSqueezyProvider(apiKey, storeId, secret, currency)
}

/** Production defaults to live; test payments may only reach the supplier sandbox. */
export function paymentTestMode(): boolean {
  return process.env.LEMONSQUEEZY_TEST_MODE === "true"
}

export function assertPaymentEnvironment(testMode: boolean) {
  const base = new URL(process.env.SWEETBOOK_API_BASE ?? "https://api-sandbox.sweetbook.com/v1")
  const sandbox = base.hostname === "api-sandbox.sweetbook.com"
  const live = base.hostname === "api.sweetbook.com"
  if (base.protocol !== "https:" || base.username || base.password || base.search
    || !["/v1", "/v1/"].includes(base.pathname)
    || (testMode && !sandbox) || (!testMode && !live)) {
    throw new PaymentError(503, "결제와 제작 환경을 확인 중입니다. 잠시 후 다시 시도해주세요.")
  }
}

export function safeCheckoutUrl(value: unknown): string {
  if (typeof value !== "string") throw new PaymentError(502, "결제 주소를 확인하지 못했습니다.")
  const url = new URL(value)
  if (url.protocol !== "https:" || !url.hostname.endsWith(".lemonsqueezy.com") || url.username || url.password) {
    throw new PaymentError(502, "결제 주소를 확인하지 못했습니다.")
  }
  return url.toString()
}
