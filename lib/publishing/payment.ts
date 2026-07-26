// 결제 어댑터.
//
// 레몬스퀴지로 시작하되 결제사에 코드를 결합하지 않는다. 주문 항목에
// digital/physical 구분을 처음부터 두어, 나중에 실물만 국내 PG로 떼어내거나
// Stripe Managed Payments로 옮기는 것이 설정 변경 수준이 되게 한다.
//
// 배경(docs/self-publishing-service-design.md): 모든 MoR이 약관상 실물 상품을
// 금지하며, 레몬스퀴지는 Stripe 인수 후 유지보수 모드다. 전환은 '언제'의 문제다.

import { createHmac, timingSafeEqual } from "node:crypto"

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
}

export interface PaymentProvider {
  readonly name: string
  createCheckout(input: CheckoutInput): Promise<{ url: string; providerCheckoutId: string }>
  verifyWebhook(rawBody: string, signature: string | null): boolean
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
  ) {}

  /**
   * 레몬스퀴지 체크아웃은 variant 하나만 받는다. 여러 줄이 필요하면
   * 결제를 나누거나 묶음 variant를 만들어야 한다 — 지금은 첫 줄만 쓰고,
   * 여러 줄이 들어오면 명시적으로 막는다.
   */
  async createCheckout(input: CheckoutInput) {
    if (input.lines.length !== 1) {
      throw new PaymentError(400, "레몬스퀴지 체크아웃은 항목 하나만 지원합니다.")
    }
    const line = input.lines[0]

    const res = await fetch(`${LS_API}/checkouts`, {
      method: "POST",
      headers: {
        Accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        data: {
          type: "checkouts",
          attributes: {
            // 가격은 최소 화폐 단위(원화는 소수가 없어 그대로).
            custom_price: Math.round(line.priceKrw),
            product_options: {
              name: line.name,
              redirect_url: input.successUrl,
            },
            checkout_data: {
              email: input.email,
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
    return {
      url: body.data.attributes.url as string,
      providerCheckoutId: String(body.data.id),
    }
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
    const name = eventName ?? body?.meta?.event_name ?? ""

    let type: PaymentEvent["type"] = "other"
    if (name === "order_created" && attrs.status === "paid") type = "paid"
    else if (name === "order_refunded" || attrs.refunded === true) type = "refunded"

    return {
      type,
      providerOrderId: String(body?.data?.id ?? ""),
      reference: custom.reference ? String(custom.reference) : null,
      email: attrs.user_email ? String(attrs.user_email) : null,
      totalMinor: Number(attrs.total ?? 0),
      currency: String(attrs.currency ?? "KRW"),
      testMode: Boolean(attrs.first_order_item?.test_mode ?? attrs.test_mode ?? false),
      rawEventName: name,
    }
  }
}

/** 환경변수에서 결제사를 만든다. 설정이 없으면 명확히 알린다. */
export function getPaymentProvider(): PaymentProvider {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY
  const storeId = process.env.LEMONSQUEEZY_STORE_ID
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET
  if (!apiKey || !storeId || !secret) {
    throw new PaymentError(500, "결제 설정이 완료되지 않았습니다.")
  }
  return new LemonSqueezyProvider(apiKey, storeId, secret)
}
