"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { estimateProductPrice } from "@/lib/publishing/pricing"

// ── 타입 (서버 어댑터 타입의 클라이언트 안전 부분집합) ─────────────────────────

export interface WizardSpec {
  bookSpecUid: string
  name: string
  innerTrimWidthMm: number
  innerTrimHeightMm: number
  pageMin: number
  pageMax: number
  pageDefault: number
  pageIncrement: number
  coverType: string
  priceBase: number
  pricePerIncrement: number
  paperSummary: string
}

interface CalculatedSize {
  coverWidthMm: number
  coverHeightMm: number
  innerWidthMm: number
  innerHeightMm: number
  spineWidthMm: number
  pdfToleranceMm: number
}

interface Shipping {
  recipientName: string
  recipientPhone: string
  postalCode: string
  address1: string
  address2: string
  memo: string
}

/** 서버가 마진을 얹어 확정한 판매가. 원가는 클라이언트로 내려오지 않는다. */
interface Estimate {
  totalPrice: number
  unitPrice: number
  quantity: number
}

const STEPS = ["판형 선택", "원고 업로드", "배송 정보", "최종 확인"] as const

const FEATURED_SPEC = "PHOTOBOOK_A5_SC"

const krw = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`

function pagesValid(spec: WizardSpec, pages: number) {
  return (
    Number.isInteger(pages) &&
    pages >= spec.pageMin &&
    pages <= spec.pageMax &&
    (pages - spec.pageMin) % spec.pageIncrement === 0
  )
}

// ── 공용 소품 ────────────────────────────────────────────────────────────────

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-white">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-text-gray">{hint}</p>}
    </div>
  )
}

const inputCls =
  "w-full bg-white/5 border border-white/15 px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-accent-orange transition-colors"

function ErrorBox({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null
  return (
    <div role="alert" className="border border-red-400/40 bg-red-400/10 px-4 py-3 space-y-1">
      {errors.map((e, i) => (
        <p key={i} className="text-sm text-red-300 leading-relaxed">
          {e}
        </p>
      ))}
    </div>
  )
}

function PrimaryButton({
  children,
  disabled,
  onClick,
  type = "button",
}: {
  children: React.ReactNode
  disabled?: boolean
  onClick?: () => void
  type?: "button" | "submit"
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-accent-orange text-white font-medium hover:bg-accent-orange/85 transition-colors disabled:opacity-40 disabled:cursor-not-allowed min-w-44"
    >
      {children}
    </button>
  )
}

function GhostButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-6 py-4 border border-white/20 text-text-gray hover:text-white hover:border-white/50 transition-colors"
    >
      {children}
    </button>
  )
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin"
    />
  )
}

function PdfDropField({
  id,
  label,
  requirement,
  file,
  onFile,
}: {
  id: string
  label: string
  requirement: string
  file: File | null
  onFile: (f: File | null) => void
}) {
  const [dragOver, setDragOver] = useState(false)
  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-white">{label}</span>
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const f = e.dataTransfer.files?.[0]
          if (f) onFile(f)
        }}
        className={`flex flex-col items-center justify-center gap-2 border border-dashed px-6 py-8 text-center transition-colors cursor-pointer ${
          dragOver
            ? "border-accent-orange bg-accent-orange/10"
            : file
              ? "border-accent-orange/60 bg-accent-orange/5"
              : "border-white/25 hover:border-white/50"
        }`}
      >
        {file ? (
          <>
            <span className="text-sm text-white break-all">{file.name}</span>
            <span className="text-xs text-text-gray">
              {(file.size / 1024 / 1024).toFixed(1)}MB · 클릭해서 다른 파일 선택
            </span>
          </>
        ) : (
          <>
            <span className="text-2xl text-accent-orange" aria-hidden>
              ↑
            </span>
            <span className="text-sm text-white">PDF를 끌어다 놓거나 클릭해서 선택</span>
          </>
        )}
        <span className="text-xs text-text-gray">{requirement}</span>
        <input
          id={id}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </label>
    </div>
  )
}

// ── 위저드 본체 ──────────────────────────────────────────────────────────────

export function PublishWizard({ specs }: { specs: WizardSpec[] }) {
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  // step 1 — 판형·사양
  const [specUid, setSpecUid] = useState(
    specs.some((s) => s.bookSpecUid === FEATURED_SPEC) ? FEATURED_SPEC : specs[0]?.bookSpecUid ?? "",
  )
  const spec = specs.find((s) => s.bookSpecUid === specUid)
  const [pages, setPages] = useState<number>(() => spec?.pageDefault ?? 0)
  const [quantity, setQuantity] = useState(1)
  const [size, setSize] = useState<CalculatedSize | null>(null)

  // step 2 — 책 정보·파일
  const [title, setTitle] = useState("")
  const [authorName, setAuthorName] = useState("")
  const [cover, setCover] = useState<File | null>(null)
  const [contents, setContents] = useState<File | null>(null)
  const [bookUid, setBookUid] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const attemptId = useRef<string>("")

  // step 3 — 배송
  const [shipping, setShipping] = useState<Shipping>({
    recipientName: "",
    recipientPhone: "",
    postalCode: "",
    address1: "",
    address2: "",
    memo: "",
  })

  // step 4 — 견적·주문
  const [estimate, setEstimate] = useState<Estimate | null>(null)
  const orderKey = useRef<string>("")
  const [done, setDone] = useState<{ orderUid: string; totalAmount: number } | null>(null)

  // 1단계 개략가(상품만, 부가세·마진 반영). 확정가는 서버 견적이 배송비까지 넣어 다시 준다.
  const estimatedTotal =
    spec && pagesValid(spec, pages) ? estimateProductPrice(spec, pages, quantity) : null

  // 판형·페이지가 확정되면 요구 PDF 규격을 조회한다 (업로드 단계 안내용)
  useEffect(() => {
    setSize(null)
    if (!spec || !pagesValid(spec, pages)) return
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      fetch(`/api/publish/size?spec=${encodeURIComponent(spec.bookSpecUid)}&pages=${pages}`, {
        signal: ctrl.signal,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d?.size && setSize(d.size))
        .catch(() => {})
    }, 300)
    return () => {
      ctrl.abort()
      clearTimeout(t)
    }
  }, [spec, pages])

  // 사양이 바뀌면 이미 만든 책·견적은 무효
  const invalidateBook = useCallback(() => {
    setBookUid(null)
    setEstimate(null)
    setWarnings([])
  }, [])

  const goto = (n: number) => {
    setErrors([])
    setStep(n)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  // ── 단계 전환 핸들러 ──

  const submitSpec = () => {
    if (!spec) return
    if (!pagesValid(spec, pages)) {
      setErrors([
        `페이지 수는 ${spec.pageMin}~${spec.pageMax} 사이, ${spec.pageIncrement}페이지 단위여야 합니다.`,
      ])
      return
    }
    goto(1)
  }

  const submitBook = async () => {
    if (!spec) return
    const es: string[] = []
    if (!title.trim()) es.push("책 제목을 입력해주세요.")
    if (!authorName.trim()) es.push("저자명을 입력해주세요.")
    if (!cover) es.push("표지 PDF를 업로드해주세요.")
    if (!contents) es.push("내지 PDF를 업로드해주세요.")
    if (es.length) {
      setErrors(es)
      return
    }

    // 이미 검증 통과한 책이 있으면 재업로드 생략
    if (bookUid) {
      goto(2)
      return
    }

    setBusy(true)
    setErrors([])
    if (!attemptId.current) attemptId.current = crypto.randomUUID()

    const form = new FormData()
    form.set("title", title.trim())
    form.set("authorName", authorName.trim())
    form.set("bookSpecUid", spec.bookSpecUid)
    form.set("pageCount", String(pages))
    form.set("attemptId", attemptId.current)
    form.set("cover", cover as File)
    form.set("contents", contents as File)

    try {
      const res = await fetch("/api/publish/books", { method: "POST", body: form })
      const data = await res.json()
      if (!res.ok) {
        attemptId.current = "" // 실패한 시도는 새 시도로 취급 (본문이 바뀔 수 있음)
        const stepLabel =
          data.step === "cover" ? "표지 PDF" : data.step === "contents" ? "내지 PDF" : "제작 준비"
        setErrors([`${stepLabel} 처리 중 문제가 발견됐습니다.`, ...(data.errors ?? [data.error])].filter(Boolean))
        return
      }
      setBookUid(data.bookUid)
      setWarnings([...(data.cover?.warnings ?? []), ...(data.contents?.warnings ?? [])])
      goto(2)
    } catch {
      setErrors(["네트워크 오류가 발생했습니다. 다시 시도해주세요."])
    } finally {
      setBusy(false)
    }
  }

  const submitShipping = async () => {
    const es: string[] = []
    if (!shipping.recipientName.trim()) es.push("받는 분 성함을 입력해주세요.")
    if (!/^[0-9+\-\s]{9,20}$/.test(shipping.recipientPhone.trim())) es.push("연락처를 확인해주세요.")
    if (!/^\d{5}$/.test(shipping.postalCode.trim())) es.push("우편번호 5자리를 입력해주세요.")
    if (!shipping.address1.trim()) es.push("주소를 입력해주세요.")
    if (es.length) {
      setErrors(es)
      return
    }

    setBusy(true)
    setErrors([])
    // 주문 본문이 여기서 확정된다 → 멱등키도 여기서 새로 발급
    orderKey.current = crypto.randomUUID()
    try {
      const res = await fetch("/api/publish/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookUid, quantity, shipping }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrors(data.errors ?? [data.error ?? "견적 조회에 실패했습니다."])
        return
      }
      setEstimate(data.estimate)
      goto(3)
    } catch {
      setErrors(["네트워크 오류가 발생했습니다. 다시 시도해주세요."])
    } finally {
      setBusy(false)
    }
  }

  const submitOrder = async () => {
    setBusy(true)
    setErrors([])
    try {
      const res = await fetch("/api/publish/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookUid,
          quantity,
          shipping,
          idempotencyKey: orderKey.current,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrors(data.errors ?? [data.error ?? "주문 생성에 실패했습니다."])
        return
      }
      // 완료 화면 금액은 저자가 4단계에서 확인한 판매가를 그대로 쓴다 (제작사 원가 아님).
      setDone({ orderUid: data.order.orderUid, totalAmount: estimate?.totalPrice ?? 0 })
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch {
      // 멱등키가 있으므로 같은 키로 재시도해도 이중 주문은 생기지 않는다
      setErrors(["네트워크 오류가 발생했습니다. 아래 버튼으로 다시 시도해주세요."])
    } finally {
      setBusy(false)
    }
  }

  // ── 완료 화면 ──

  if (done) {
    return (
      <div className="max-w-2xl mx-auto text-center space-y-8 py-8">
        <div className="w-16 h-16 mx-auto rounded-full border-2 border-accent-orange flex items-center justify-center">
          <span className="text-2xl text-accent-orange" aria-hidden>
            ✓
          </span>
        </div>
        <div className="space-y-3">
          <h2 className="font-playfair text-3xl sm:text-4xl font-light text-white">
            주문이 접수되었습니다
          </h2>
          <p className="text-text-gray leading-relaxed">
            책이 인쇄소로 전달되었습니다. 아래 주문번호로 언제든 진행 상황을 확인할 수 있으니
            꼭 보관해주세요.
          </p>
        </div>
        <div className="border border-white/15 bg-white/5 px-6 py-5 space-y-2">
          <p className="text-xs uppercase tracking-widest text-text-gray">주문번호</p>
          <p className="text-lg text-accent-orange font-medium break-all select-all">{done.orderUid}</p>
          <p className="text-sm text-text-gray">결제 금액 {krw(done.totalAmount)}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href={`/publish/orders/${done.orderUid}`}
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-accent-orange text-white font-medium hover:bg-accent-orange/85 transition-colors"
          >
            진행 상황 보기 →
          </Link>
          <Link
            href="/publish"
            className="inline-flex items-center justify-center px-8 py-4 border border-white/20 text-text-gray hover:text-white hover:border-white/50 transition-colors"
          >
            소개 페이지로
          </Link>
        </div>
      </div>
    )
  }

  if (!spec) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16 space-y-4">
        <p className="text-text-gray">지금은 판형 정보를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.</p>
        <Link href="/publish" className="text-accent-orange hover:underline">
          ← 소개 페이지로 돌아가기
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-10">
      {/* 진행 표시 */}
      <ol className="flex items-center justify-between gap-2" aria-label="진행 단계">
        {STEPS.map((label, i) => (
          <li key={label} className="flex-1 flex flex-col items-center gap-2">
            <span
              aria-current={i === step ? "step" : undefined}
              className={`w-8 h-8 rounded-full border flex items-center justify-center text-sm transition-colors ${
                i < step
                  ? "border-accent-orange bg-accent-orange text-white"
                  : i === step
                    ? "border-accent-orange text-accent-orange"
                    : "border-white/20 text-white/40"
              }`}
            >
              {i < step ? "✓" : i + 1}
            </span>
            <span
              className={`text-xs sm:text-sm ${i === step ? "text-white" : "text-text-gray"}`}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>

      <ErrorBox errors={errors} />

      {/* STEP 1 — 판형 선택 */}
      {step === 0 && (
        <section className="space-y-8">
          <div className="grid sm:grid-cols-2 gap-4" role="radiogroup" aria-label="판형 선택">
            {specs.map((s) => {
              const selected = s.bookSpecUid === specUid
              return (
                <button
                  key={s.bookSpecUid}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    setSpecUid(s.bookSpecUid)
                    setPages(s.pageDefault)
                    invalidateBook()
                  }}
                  className={`text-left border px-5 py-5 space-y-2 transition-colors ${
                    selected
                      ? "border-accent-orange bg-accent-orange/10"
                      : "border-white/15 hover:border-white/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-white font-medium leading-snug">{s.name}</span>
                    {s.bookSpecUid === FEATURED_SPEC && (
                      <span className="shrink-0 text-[11px] px-2 py-0.5 border border-accent-orange text-accent-orange">
                        에세이 추천
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-text-gray">
                    {s.innerTrimWidthMm}×{s.innerTrimHeightMm}mm · {s.coverType === "Hardcover" ? "하드커버" : "소프트커버"} ·{" "}
                    {s.pageMin}~{s.pageMax}p
                  </p>
                  <p className="text-sm text-white">
                    {krw(s.priceBase)}부터 <span className="text-text-gray">/ 1권</span>
                  </p>
                  {s.paperSummary && <p className="text-xs text-text-gray">{s.paperSummary}</p>}
                </button>
              )
            })}
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            <Field
              label="페이지 수"
              htmlFor="pages"
              hint={`${spec.pageMin}~${spec.pageMax}페이지, ${spec.pageIncrement}페이지 단위`}
            >
              <input
                id="pages"
                type="number"
                inputMode="numeric"
                min={spec.pageMin}
                max={spec.pageMax}
                step={spec.pageIncrement}
                value={Number.isNaN(pages) ? "" : pages}
                onChange={(e) => {
                  setPages(e.target.valueAsNumber)
                  invalidateBook()
                }}
                className={inputCls}
              />
            </Field>
            <Field label="수량" htmlFor="quantity" hint="1~100권">
              <input
                id="quantity"
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                value={quantity}
                onChange={(e) => {
                  setQuantity(Math.max(1, Math.min(100, Math.round(e.target.valueAsNumber) || 1)))
                  setEstimate(null)
                }}
                className={inputCls}
              />
            </Field>
          </div>

          <div className="border border-white/15 bg-white/5 px-5 py-4 space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-text-gray">예상 금액 (배송비 별도)</span>
              <span className="text-lg text-white">
                {estimatedTotal !== null ? (
                  <>
                    <span className="text-accent-orange font-medium">{krw(estimatedTotal)}</span>
                    {quantity > 1 && (
                      <span className="text-sm text-text-gray">
                        {" "}
                        · 권당 {krw(estimatedTotal / quantity)}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-text-gray text-sm">페이지 수를 확인해주세요</span>
                )}
              </span>
            </div>
            <p className="text-xs text-text-gray">
              부가세 포함. 여러 권을 주문하면 권당 가격이 내려갑니다.
            </p>
          </div>

          <div className="flex justify-end">
            <PrimaryButton onClick={submitSpec}>다음 — 원고 업로드 →</PrimaryButton>
          </div>
        </section>
      )}

      {/* STEP 2 — 원고 업로드 */}
      {step === 1 && (
        <section className="space-y-8">
          <div className="grid sm:grid-cols-2 gap-6">
            <Field label="책 제목" htmlFor="title">
              <input
                id="title"
                type="text"
                maxLength={200}
                value={title}
                placeholder="예) 길에서 만나다"
                onChange={(e) => {
                  setTitle(e.target.value)
                  invalidateBook()
                }}
                className={inputCls}
              />
            </Field>
            <Field label="저자명" htmlFor="author">
              <input
                id="author"
                type="text"
                maxLength={100}
                value={authorName}
                placeholder="표지에 실리는 이름"
                onChange={(e) => {
                  setAuthorName(e.target.value)
                  invalidateBook()
                }}
                className={inputCls}
              />
            </Field>
          </div>

          {size && (
            <div className="border border-white/15 bg-white/5 px-5 py-4 text-sm leading-relaxed">
              <p className="text-white mb-1">
                선택한 사양 — {spec.name}, {pages}페이지
              </p>
              <p className="text-text-gray">
                표지 PDF <span className="text-white">{size.coverWidthMm}×{size.coverHeightMm}mm</span> 1페이지 (책등{" "}
                {size.spineWidthMm}mm 포함) · 내지 PDF{" "}
                <span className="text-white">{size.innerWidthMm}×{size.innerHeightMm}mm</span> {pages}페이지 · 허용 오차 ±
                {size.pdfToleranceMm}mm
              </p>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-6">
            <PdfDropField
              id="cover-pdf"
              label="표지 PDF"
              requirement={size ? `${size.coverWidthMm}×${size.coverHeightMm}mm · 1페이지` : "펼침 표지 1페이지"}
              file={cover}
              onFile={(f) => {
                setCover(f)
                invalidateBook()
              }}
            />
            <PdfDropField
              id="contents-pdf"
              label="내지 PDF"
              requirement={size ? `${size.innerWidthMm}×${size.innerHeightMm}mm · ${pages}페이지` : `${pages}페이지`}
              file={contents}
              onFile={(f) => {
                setContents(f)
                invalidateBook()
              }}
            />
          </div>

          <p className="text-xs text-text-gray leading-relaxed">
            업로드하면 인쇄소 규격(크기·페이지 수)을 즉시 검증합니다. 규격이 맞지 않으면 이유를
            알려드리니 파일을 수정해 다시 올려주세요. 원고 파일은 인쇄 목적 외에 사용하지 않습니다.
          </p>

          {warnings.length > 0 && (
            <div className="border border-yellow-400/40 bg-yellow-400/10 px-4 py-3 space-y-1">
              {warnings.map((w, i) => (
                <p key={i} className="text-sm text-yellow-200">
                  {w}
                </p>
              ))}
            </div>
          )}

          <div className="flex justify-between gap-3">
            <GhostButton onClick={() => goto(0)}>← 이전</GhostButton>
            <PrimaryButton onClick={submitBook} disabled={busy}>
              {busy ? (
                <>
                  <Spinner /> 규격 검증 중…
                </>
              ) : bookUid ? (
                "다음 — 배송 정보 →"
              ) : (
                "업로드하고 검증하기 →"
              )}
            </PrimaryButton>
          </div>
        </section>
      )}

      {/* STEP 3 — 배송 정보 */}
      {step === 2 && (
        <section className="space-y-8">
          <div className="grid sm:grid-cols-2 gap-6">
            <Field label="받는 분" htmlFor="recipient">
              <input
                id="recipient"
                type="text"
                autoComplete="name"
                maxLength={100}
                value={shipping.recipientName}
                onChange={(e) => setShipping({ ...shipping, recipientName: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="연락처" htmlFor="phone">
              <input
                id="phone"
                type="tel"
                autoComplete="tel"
                maxLength={20}
                placeholder="010-0000-0000"
                value={shipping.recipientPhone}
                onChange={(e) => setShipping({ ...shipping, recipientPhone: e.target.value })}
                className={inputCls}
              />
            </Field>
          </div>
          <div className="grid sm:grid-cols-[10rem_1fr] gap-6">
            <Field label="우편번호" htmlFor="postal">
              <input
                id="postal"
                type="text"
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={5}
                placeholder="12345"
                value={shipping.postalCode}
                onChange={(e) => setShipping({ ...shipping, postalCode: e.target.value.replace(/\D/g, "") })}
                className={inputCls}
              />
            </Field>
            <Field label="주소" htmlFor="addr1">
              <input
                id="addr1"
                type="text"
                autoComplete="address-line1"
                maxLength={200}
                value={shipping.address1}
                onChange={(e) => setShipping({ ...shipping, address1: e.target.value })}
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="상세 주소 (선택)" htmlFor="addr2">
            <input
              id="addr2"
              type="text"
              autoComplete="address-line2"
              maxLength={200}
              value={shipping.address2}
              onChange={(e) => setShipping({ ...shipping, address2: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="배송 메모 (선택)" htmlFor="memo">
            <input
              id="memo"
              type="text"
              maxLength={200}
              placeholder="예) 부재 시 경비실에 맡겨주세요"
              value={shipping.memo}
              onChange={(e) => setShipping({ ...shipping, memo: e.target.value })}
              className={inputCls}
            />
          </Field>

          <div className="flex justify-between gap-3">
            <GhostButton onClick={() => goto(1)}>← 이전</GhostButton>
            <PrimaryButton onClick={submitShipping} disabled={busy}>
              {busy ? (
                <>
                  <Spinner /> 견적 확인 중…
                </>
              ) : (
                "다음 — 최종 확인 →"
              )}
            </PrimaryButton>
          </div>
        </section>
      )}

      {/* STEP 4 — 최종 확인 */}
      {step === 3 && estimate && (
        <section className="space-y-8">
          <div className="border border-white/15 divide-y divide-white/10">
            <SummaryRow k="책" v={`${title} — ${authorName}`} />
            <SummaryRow k="사양" v={`${spec.name} · ${pages}페이지 · ${quantity}권`} />
            <SummaryRow
              k="배송지"
              v={`${shipping.recipientName} · ${shipping.address1} ${shipping.address2} (${shipping.postalCode})`}
            />
            {estimate.quantity > 1 && (
              <SummaryRow k="권당 가격" v={krw(estimate.unitPrice)} />
            )}
            <div className="flex items-center justify-between px-5 py-4 bg-white/5">
              <div>
                <span className="text-white font-medium">최종 결제 금액</span>
                <p className="text-xs text-text-gray">배송비·부가세 포함</p>
              </div>
              <span className="text-xl text-accent-orange font-medium">
                {krw(estimate.totalPrice)}
              </span>
            </div>
          </div>

          <p className="text-xs text-text-gray leading-relaxed">
            주문 확정 시 인쇄가 접수됩니다. 제작이 시작되기 전(결제완료·PDF준비 단계)까지는 취소가
            가능하며, 이후에는 취소할 수 없습니다. 문의: 소개 페이지 하단 연락처.
          </p>

          <div className="flex justify-between gap-3">
            <GhostButton onClick={() => goto(2)}>← 이전</GhostButton>
            <PrimaryButton onClick={submitOrder} disabled={busy}>
              {busy ? (
                <>
                  <Spinner /> 주문 접수 중…
                </>
              ) : (
                "주문 확정하기"
              )}
            </PrimaryButton>
          </div>
        </section>
      )}
    </div>
  )
}

function SummaryRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-4">
      <span className="text-sm text-text-gray shrink-0">{k}</span>
      <span className="text-sm text-white text-right leading-relaxed">{v}</span>
    </div>
  )
}
