// SweetBook "Book Print API" 어댑터.
// 외부 API 필드 매핑은 이 파일 안에만 존재한다 (docs/self-publishing-service-design.md).
// 서버 전용: SWEETBOOK_API_KEY를 사용하므로 클라이언트에서 import 금지.

const API_BASE =
  process.env.SWEETBOOK_API_BASE ?? "https://api-sandbox.sweetbook.com/v1"

export interface BookSpec {
  bookSpecUid: string
  name: string
  innerTrimWidthMm: number
  innerTrimHeightMm: number
  pageMin: number
  pageMax: number
  pageDefault: number
  pageIncrement: number
  coverType: "Softcover" | "Hardcover"
  bindingType: string
  priceCurrency: string
  // Sandbox 응답은 sandbox* 필드로 단가를 제공한다 (문서: 환경 Sandbox/Live).
  // 실측상 두 필드가 모두 내려오지만, Live에서 커스텀가가 priceBase에 반영되므로
  // priceBase를 우선하고 없을 때만 sandbox 값으로 떨어진다.
  priceBase: number
  pricePerIncrement: number
  sandboxPriceBase?: number
  sandboxPricePerIncrement?: number
  paper?: {
    cover?: { paper?: string }
    inner?: { paper?: string }
    lamination?: string
  }
  bleedMm: number
}

export interface CalculatedSize {
  bookSpecUid: string
  pages: number
  unit: "mm"
  coverWidthMm: number
  coverHeightMm: number
  innerWidthMm: number
  innerHeightMm: number
  spineWidthMm: number
  pdfToleranceMm: number
}

export interface PdfUploadResult {
  bookUid: string
  kind: "cover" | "contents"
  valid: boolean
  pageCount: number
  pdfSizeMm: { width: number; height: number }
  messages: string[]
  warnings: string[]
}

export interface ShippingInfo {
  recipientName: string
  recipientPhone: string
  postalCode: string
  address1: string
  address2?: string
  memo?: string
}

export interface OrderRequest {
  items: { bookUid: string; quantity: number }[]
  shipping: ShippingInfo
  externalRef?: string
}

export interface Estimate {
  totalProductAmount?: number
  totalShippingFee?: number
  totalPackagingFee?: number
  totalAmount?: number
  paidCreditAmount: number
  creditBalance: number
  creditSufficient: boolean
  [key: string]: unknown
}

export interface OrderItem {
  itemUid: string
  bookUid: string
  bookTitle: string
  quantity: number
  pageCount?: number
  unitPrice: number
  itemAmount: number
  itemStatus: string
  itemStatusDisplay: string
}

export interface Order {
  orderUid: string
  orderStatus: string
  orderStatusDisplay: string
  externalRef?: string | null
  totalProductAmount: number
  totalShippingFee: number
  totalPackagingFee: number
  totalAmount: number
  recipientName: string
  recipientPhone?: string
  postalCode?: string
  address1?: string
  address2?: string
  orderedAt: string
  isTest?: boolean
  items?: OrderItem[]
}

/** SweetBook API 오류. errors 배열에 사용자에게 그대로 보여줄 한글 사유가 담긴다. */
export class SweetBookError extends Error {
  constructor(
    public status: number,
    public errorCode: string | null,
    public errors: string[],
    message: string,
  ) {
    super(message)
    this.name = "SweetBookError"
  }
}

interface ApiEnvelope<T> {
  success: boolean
  message: string
  data: T
  errorCode?: string
  errors?: string[]
}

async function request<T>(
  path: string,
  init: RequestInit & { idempotencyKey?: string } = {},
): Promise<T> {
  const key = process.env.SWEETBOOK_API_KEY
  if (!key) {
    throw new SweetBookError(500, "ERR_CONFIG", ["SWEETBOOK_API_KEY 환경변수가 설정되지 않았습니다."], "missing api key")
  }

  const headers = new Headers(init.headers)
  headers.set("Authorization", `Bearer ${key}`)
  if (init.idempotencyKey) headers.set("Idempotency-Key", init.idempotencyKey)

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, cache: "no-store" })

  // 429는 Retry-After(초)를 존중한다. 본문 shape가 6필드 표준을 따르지 않으므로 먼저 분기.
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("Retry-After")) || 60
    throw new SweetBookError(429, "ERR_TOO_MANY_REQUESTS", [
      `요청이 몰리고 있습니다. ${retryAfter}초 후 다시 시도해주세요.`,
    ], `rate limited, retry after ${retryAfter}s`)
  }

  let body: ApiEnvelope<T>
  try {
    body = (await res.json()) as ApiEnvelope<T>
  } catch {
    throw new SweetBookError(res.status, null, ["제작사 응답을 해석할 수 없습니다."], `non-JSON response ${res.status}`)
  }

  if (!res.ok || !body.success) {
    throw new SweetBookError(
      res.status,
      body.errorCode ?? null,
      body.errors?.length ? body.errors : [body.message],
      body.message,
    )
  }
  return body.data
}

export function listBookSpecs(): Promise<BookSpec[]> {
  return request<BookSpec[]>("/book-specs")
}

export function getCalculatedSize(bookSpecUid: string, pages: number): Promise<CalculatedSize> {
  return request<CalculatedSize>(
    `/book-specs/${encodeURIComponent(bookSpecUid)}/calculated-size?pages=${pages}`,
  )
}

export function createBook(
  input: { title: string; bookSpecUid: string; pageCount: number; externalRef?: string },
  idempotencyKey?: string,
): Promise<{ bookUid: string }> {
  return request<{ bookUid: string }>("/books", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, creationType: "PDF_UPLOAD" }),
    idempotencyKey,
  })
}

/** 표지/내지 PDF 업로드. 재시도(이미 등록됨 409)에는 PUT으로 교체한다. */
export async function uploadPdf(
  bookUid: string,
  kind: "cover" | "contents",
  file: File,
): Promise<PdfUploadResult> {
  const path = `/books/${encodeURIComponent(bookUid)}/${kind === "cover" ? "pdf-cover" : "pdf-contents"}`
  const form = new FormData()
  form.set("file", file, file.name || `${kind}.pdf`)

  try {
    return await request<PdfUploadResult>(path, { method: "POST", body: form })
  } catch (e) {
    if (e instanceof SweetBookError && e.status === 409) {
      const replaceForm = new FormData()
      replaceForm.set("file", file, file.name || `${kind}.pdf`)
      return request<PdfUploadResult>(path, { method: "PUT", body: replaceForm })
    }
    throw e
  }
}

export function finalizeBook(bookUid: string, idempotencyKey?: string): Promise<unknown> {
  return request(`/books/${encodeURIComponent(bookUid)}/finalization`, {
    method: "POST",
    idempotencyKey,
  })
}

export function estimateOrder(order: OrderRequest): Promise<Estimate> {
  return request<Estimate>("/orders/estimate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(order),
  })
}

export function createOrder(order: OrderRequest, idempotencyKey: string): Promise<Order> {
  return request<Order>("/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(order),
    idempotencyKey,
  })
}

export function getOrder(orderUid: string): Promise<Order> {
  return request<Order>(`/orders/${encodeURIComponent(orderUid)}`)
}
