"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { estimateProductPrice } from "@/lib/publishing/pricing"
import type { WizardSpec } from "./publish-wizard"

interface SizeOption {
  textSize: "small" | "normal" | "large"
  pages: number
  padded: number
  blocked: boolean
  ok: boolean
}

interface Summary {
  pageCount: number
  paddedPages: number
  withinSpec: boolean
  notes: string[]
  manuscript: { chapters: number; paragraphs: number; chars: number }
  spec: { uid: string; name: string; pageMin: number; pageMax: number }
  priceTotal: number
  quantity: number
  sizeOptions: SizeOption[]
  advice: string
}

const SIZE_LABEL = { small: "작게", normal: "보통", large: "크게" } as const
const THEME_LABEL = { ivory: "아이보리", charcoal: "차콜", photo: "사진" } as const
type CoverTheme = keyof typeof THEME_LABEL
const krw = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`

interface CoverSummary {
  widthMm: number
  heightMm: number
  spineWidthMm: number
  spineTextIncluded: boolean
  notes: string[]
}

// ── PDF 렌더링 ────────────────────────────────────────────────────────────

type PdfDoc = { numPages: number; getPage: (n: number) => Promise<any> }

async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist")
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString()
  return pdfjs
}

/** 한 면을 캔버스에 그린다. 실제 인쇄 PDF를 그대로 래스터라이즈하므로 결과가 정확하다. */
function PageCanvas({ doc, pageNumber, scale }: { doc: PdfDoc | null; pageNumber: number; scale: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let cancelled = false
    let task: { cancel: () => void; promise: Promise<void> } | null = null
    const canvas = ref.current
    if (!doc || !canvas || pageNumber < 1 || pageNumber > doc.numPages) return

    doc.getPage(pageNumber).then((page: any) => {
      if (cancelled) return
      const viewport = page.getViewport({ scale })
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(viewport.width * dpr)
      canvas.height = Math.floor(viewport.height * dpr)
      canvas.style.width = `${Math.floor(viewport.width)}px`
      canvas.style.height = `${Math.floor(viewport.height)}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      task = page.render({ canvasContext: ctx, viewport })
      // cancel()은 이 promise를 reject시킨다. 잡지 않으면 쪽을 넘기거나 다시
      // 조판할 때마다 unhandled rejection이 올라온다.
      task!.promise.catch(() => {})
    })

    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [doc, pageNumber, scale])

  if (!doc || pageNumber < 1 || pageNumber > doc.numPages) {
    // 펼침면의 빈 자리(표지 안쪽 등)는 자리만 잡아 균형을 유지한다.
    return (
      <div
        aria-hidden
        className="bg-white/5 border border-white/5 max-w-full"
        style={{ width: 210, aspectRatio: "210 / 297" }}
      />
    )
  }
  // 캔버스는 픽셀 크기가 style로 고정되므로 좁은 화면에서 그대로 두면 넘친다.
  // 비트맵은 그대로 두고 표시 크기만 줄여 화면에 맞춘다.
  return (
    <canvas ref={ref} className="bg-white shadow-2xl max-w-full h-auto" aria-label={`${pageNumber}쪽`} />
  )
}

// ── 소품 ─────────────────────────────────────────────────────────────────

const inputCls =
  "w-full bg-white/5 border border-white/15 px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-accent-orange transition-colors"

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string; disabled?: boolean; hint?: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-white">{label}</span>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={`px-3 py-2.5 text-sm border transition-colors ${
              value === o.value
                ? "border-accent-orange bg-accent-orange/10 text-white"
                : o.disabled
                  ? "border-white/10 text-white/25 cursor-not-allowed"
                  : "border-white/15 text-text-gray hover:border-white/40 hover:text-white"
            }`}
          >
            {o.label}
            {o.hint && <span className="block text-[11px] opacity-70">{o.hint}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin motion-reduce:animate-none"
    />
  )
}

const TYPESET_PHASES = ["원고를 읽는 중", "쪽을 나누는 중", "미리보기를 그리는 중"] as const
const PAY_PHASES = ["조판을 다시 확인하는 중", "결제 페이지를 여는 중"] as const

function typesetKey(
  file: File | null,
  specUid: string,
  textSize: string,
  chapterNewPage: boolean,
  title: string,
  authorName: string,
) {
  return [
    file ? `${file.name}:${file.size}:${file.lastModified}` : "",
    specUid,
    textSize,
    chapterNewPage ? "1" : "0",
    title.trim(),
    authorName.trim(),
  ].join("|")
}

function payError(
  email: string,
  shipping: { recipientName: string; recipientPhone: string; postalCode: string; address1: string },
) {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return "연락받을 이메일을 확인해주세요."
  if (!shipping.recipientName.trim()) return "받는 분 성함을 입력해주세요."
  if (!/^[0-9+\-\s]{9,20}$/.test(shipping.recipientPhone.trim())) return "연락처를 확인해주세요."
  if (!/^\d{5}$/.test(shipping.postalCode.trim())) return "우편번호 5자리를 입력해주세요."
  if (!shipping.address1.trim()) return "주소를 입력해주세요."
  return null
}

// ── 본체 ─────────────────────────────────────────────────────────────────

export function ManuscriptStudio({ specs }: { specs: WizardSpec[] }) {
  const featured = specs.find((s) => s.bookSpecUid === "PHOTOBOOK_A5_SC") ?? specs[0]

  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState("")
  const [authorName, setAuthorName] = useState("")
  const [specUid, setSpecUid] = useState(featured?.bookSpecUid ?? "")
  const [textSize, setTextSize] = useState<"small" | "normal" | "large">("normal")
  const [chapterNewPage, setChapterNewPage] = useState(true)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [doc, setDoc] = useState<PdfDoc | null>(null)
  const [spread, setSpread] = useState(0)
  const [dragOver, setDragOver] = useState(false)

  // 표지 — 내지 조판이 끝나 쪽수가 확정돼야 책등 두께를 계산할 수 있다.
  const [theme, setTheme] = useState<CoverTheme>("ivory")
  const [backText, setBackText] = useState("")
  const [coverImage, setCoverImage] = useState<File | null>(null)
  const [coverBusy, setCoverBusy] = useState(false)
  const [coverDoc, setCoverDoc] = useState<PdfDoc | null>(null)
  const [coverInfo, setCoverInfo] = useState<CoverSummary | null>(null)
  const [tab, setTab] = useState<"inner" | "cover">("inner")

  const [typesetStamp, setTypesetStamp] = useState<string | null>(null)
  const [typesetPhase, setTypesetPhase] = useState(0)
  const [wantOrder, setWantOrder] = useState(false)
  const [payPhase, setPayPhase] = useState(0)

  const [email, setEmail] = useState("")
  const [quantity, setQuantity] = useState(1)
  const [payBusy, setPayBusy] = useState(false)
  const [shipping, setShipping] = useState({
    recipientName: "",
    recipientPhone: "",
    postalCode: "",
    address1: "",
    address2: "",
    memo: "",
  })

  const spec = specs.find((s) => s.bookSpecUid === specUid)
  const displayPrice =
    spec && summary
      ? estimateProductPrice(
          {
            pageMin: spec.pageMin,
            pageIncrement: spec.pageIncrement,
            priceBase: spec.priceBase,
            pricePerIncrement: spec.pricePerIncrement,
          },
          summary.pageCount,
          quantity,
        )
      : summary?.priceTotal

  const currentKey = typesetKey(file, specUid, textSize, chapterNewPage, title, authorName)
  const dirty = Boolean(doc && typesetStamp && typesetStamp !== currentKey)

  const chooseFile = useCallback((next: File | null) => {
    setFile(next)
    setDoc(null)
    setSummary(null)
    setCoverDoc(null)
    setCoverInfo(null)
    setTypesetStamp(null)
    setWantOrder(false)
    setTab("inner")
    setSpread(0)
    setError(null)
  }, [])

  useEffect(() => {
    if (!busy) {
      setTypesetPhase(0)
      return
    }
    const id = window.setInterval(() => {
      setTypesetPhase((p) => (p + 1) % TYPESET_PHASES.length)
    }, 2200)
    return () => window.clearInterval(id)
  }, [busy])

  useEffect(() => {
    if (!payBusy) {
      setPayPhase(0)
      return
    }
    const id = window.setInterval(() => {
      setPayPhase((p) => (p + 1) % PAY_PHASES.length)
    }, 2400)
    return () => window.clearInterval(id)
  }, [payBusy])

  // 인쇄용 PDF는 blob URL로 만들지 않는다. 미리보기는 바이트를 pdf.js에 직접
  // 넘기면 되고, blob: URL을 만들면 주소창에 붙여넣는 것만으로 원본이 새어나간다.

  const runCover = useCallback(async () => {
    if (!summary) return
    setCoverBusy(true)
    setError(null)

    const form = new FormData()
    form.set("bookSpecUid", specUid)
    form.set("pages", String(summary.pageCount))
    form.set("theme", theme)
    form.set("title", title)
    form.set("authorName", authorName)
    form.set("backText", backText)
    if (coverImage) form.set("image", coverImage)

    try {
      const res = await fetch("/api/publish/cover", { method: "POST", body: form })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? "표지 생성에 실패했습니다.")
        return
      }
      const raw = res.headers.get("X-Cover-Summary")
      const info: CoverSummary | null = raw
        ? JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(raw), (c) => c.charCodeAt(0))))
        : null

      const blob = await res.blob()
      const bytes = new Uint8Array(await blob.arrayBuffer())
      const pdfjs = await loadPdfjs()
      const loaded = await pdfjs.getDocument({ data: bytes }).promise

      setCoverDoc(loaded as unknown as PdfDoc)
      setCoverInfo(info)
      setTab("cover")
    } catch {
      setError("표지 생성 중 문제가 생겼습니다. 다시 시도해주세요.")
    } finally {
      setCoverBusy(false)
    }
  }, [summary, specUid, theme, title, authorName, backText, coverImage])

  const runTypeset = useCallback(async () => {
    if (!file) {
      setError("원고 파일을 올려주세요.")
      return
    }
    setBusy(true)
    setError(null)

    const form = new FormData()
    form.set("manuscript", file)
    form.set("bookSpecUid", specUid)
    form.set("textSize", textSize)
    form.set("chapterStartsNewPage", String(chapterNewPage))
    form.set("title", title)
    form.set("authorName", authorName)

    try {
      const res = await fetch("/api/publish/typeset", { method: "POST", body: form })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? "조판에 실패했습니다.")
        return
      }
      const raw = res.headers.get("X-Typeset-Summary")
      const parsedSummary: Summary | null = raw
        ? JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(raw), (c) => c.charCodeAt(0))))
        : null

      const blob = await res.blob()
      const bytes = new Uint8Array(await blob.arrayBuffer())

      const pdfjs = await loadPdfjs()
      const loaded = await pdfjs.getDocument({ data: bytes }).promise

      setDoc(loaded as unknown as PdfDoc)
      setSummary(parsedSummary)
      setSpread(0)
      setTypesetStamp(typesetKey(file, specUid, textSize, chapterNewPage, title, authorName))
      setWantOrder(false)
      setCoverDoc(null)
      setCoverInfo(null)
      setTab("inner")
    } catch {
      setError("조판 중 문제가 생겼습니다. 다시 시도해주세요.")
    } finally {
      setBusy(false)
    }
  }, [file, specUid, textSize, chapterNewPage, title, authorName])

  const startCheckout = useCallback(async () => {
    if (!file || !summary) {
      setError("먼저 조판해서 미리보기를 확인해주세요.")
      return
    }
    if (dirty) {
      setError("옵션이 바뀌었습니다. 다시 조판한 뒤 결제해주세요.")
      return
    }
    const fieldError = payError(email, shipping)
    if (fieldError) {
      setError(fieldError)
      return
    }
    setPayBusy(true)
    setError(null)
    const form = new FormData()
    form.set("manuscript", file)
    form.set("email", email)
    form.set("title", title)
    form.set("authorName", authorName)
    form.set("bookSpecUid", specUid)
    form.set("textSize", textSize)
    form.set("chapterStartsNewPage", String(chapterNewPage))
    form.set("coverTheme", theme)
    form.set("backText", backText)
    form.set("quantity", String(quantity))
    form.set("recipientName", shipping.recipientName)
    form.set("recipientPhone", shipping.recipientPhone)
    form.set("postalCode", shipping.postalCode)
    form.set("address1", shipping.address1)
    form.set("address2", shipping.address2)
    form.set("shippingMemo", shipping.memo)
    if (coverImage) form.set("coverImage", coverImage)

    try {
      const res = await fetch("/api/publish/checkout", { method: "POST", body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.checkoutUrl) {
        setError(data.error ?? "결제 페이지를 만들지 못했습니다.")
        return
      }
      window.location.href = data.checkoutUrl
    } catch {
      setError("결제 준비 중 문제가 생겼습니다. 다시 시도해주세요.")
    } finally {
      setPayBusy(false)
    }
  }, [file, summary, dirty, email, title, authorName, specUid, textSize, chapterNewPage, theme, backText, quantity, shipping, coverImage])

  // 1쪽은 오른쪽 면. 이후 (2,3) (4,5) … 로 실제 책처럼 펼친다.
  const totalSpreads = doc ? Math.floor(doc.numPages / 2) + 1 : 0
  const leftPage = spread === 0 ? 0 : spread * 2
  const rightPage = spread === 0 ? 1 : spread * 2 + 1

  return (
    <div className="grid lg:grid-cols-[22rem_1fr] gap-8 items-start">
      {/* 조작 패널 */}
      <div className="space-y-6">
        <div className="space-y-2">
          <span className="block text-sm font-medium text-white">원고 파일</span>
          <label
            htmlFor="manuscript"
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              const f = e.dataTransfer.files?.[0]
              if (f) chooseFile(f)
            }}
            className={`flex flex-col items-center justify-center gap-2 border border-dashed px-5 py-7 text-center cursor-pointer transition-colors ${
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
                <span className="text-xs text-text-gray">클릭해서 다른 파일 선택</span>
              </>
            ) : (
              <>
                <span className="text-2xl text-accent-orange" aria-hidden>↑</span>
                <span className="text-sm text-white">원고를 끌어다 놓거나 클릭</span>
                <span className="text-xs text-text-gray">.docx · .md · .txt</span>
              </>
            )}
            <input
              id="manuscript"
              type="file"
              accept=".docx,.md,.txt"
              className="sr-only"
              onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <p className="text-xs text-text-gray leading-relaxed">
            한글(.hwp)을 쓰신다면 <span className="text-white">다른 이름으로 저장 → .docx</span>로
            저장해 올려주세요.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label htmlFor="s-title" className="block text-sm font-medium text-white">책 제목</label>
            <input id="s-title" type="text" maxLength={200} value={title}
              placeholder="길에서 만나다"
              onChange={(e) => setTitle(e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-2">
            <label htmlFor="s-author" className="block text-sm font-medium text-white">저자명</label>
            <input id="s-author" type="text" maxLength={100} value={authorName}
              placeholder="이상민"
              onChange={(e) => setAuthorName(e.target.value)} className={inputCls} />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="s-spec" className="block text-sm font-medium text-white">판형</label>
          <select id="s-spec" value={specUid} onChange={(e) => setSpecUid(e.target.value)} className={inputCls}>
            {specs.map((s) => (
              <option key={s.bookSpecUid} value={s.bookSpecUid} className="bg-[#1a1a1a]">
                {s.name} ({s.innerTrimWidthMm}×{s.innerTrimHeightMm}mm, {s.pageMin}~{s.pageMax}p)
              </option>
            ))}
          </select>
        </div>

        <Segmented
          label="본문 크기"
          value={textSize}
          onChange={setTextSize}
          options={(["small", "normal", "large"] as const).map((v) => {
            const o = summary?.sizeOptions.find((x) => x.textSize === v)
            return {
              value: v,
              label: SIZE_LABEL[v],
              // 빈 페이지가 생기는 건 알리되 막지는 않는다. 막는 건 상한 초과뿐.
              hint: o ? (o.padded > 0 ? `~${o.pages}쪽 (빈 ${o.padded})` : `~${o.pages}쪽`) : undefined,
              disabled: o?.blocked ?? false,
            }
          })}
        />

        <label className="flex items-start gap-3 cursor-pointer group">
          <input type="checkbox" checked={chapterNewPage}
            onChange={(e) => setChapterNewPage(e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 accent-[#ff6b35]" />
          <span className="text-sm text-text-gray group-hover:text-white transition-colors">
            새로운 장을 새 페이지에서 시작
          </span>
        </label>

        <button
          type="button"
          onClick={runTypeset}
          disabled={busy || !file}
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 bg-accent-orange text-white font-medium hover:bg-accent-orange/85 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy ? (
            <>
              <Spinner /> {TYPESET_PHASES[typesetPhase]}…
            </>
          ) : doc ? (
            dirty ? "바뀐 설정으로 다시 조판하기" : "다시 조판하기"
          ) : (
            "조판해서 미리보기 →"
          )}
        </button>

        {error && (
          <div role="alert" className="border border-red-400/40 bg-red-400/10 px-4 py-3">
            <p className="text-sm text-red-300 leading-relaxed">{error}</p>
          </div>
        )}

        {dirty && (
          <div role="status" className="border border-yellow-400/40 bg-yellow-400/10 px-4 py-3">
            <p className="text-sm text-yellow-200 leading-relaxed">
              제목·판형·본문 크기가 미리보기와 다릅니다. 다시 조판해야 이 설정으로 인쇄됩니다.
            </p>
          </div>
        )}

        {summary && (
          <div className="border border-white/15 divide-y divide-white/10 text-sm animate-studio-in motion-reduce:animate-none">
            <div className="px-4 py-3 flex justify-between">
              <span className="text-text-gray">원고</span>
              <span className="text-white">
                {summary.manuscript.chapters}장 · {summary.manuscript.chars.toLocaleString()}자
              </span>
            </div>
            <div className="px-4 py-3 flex justify-between">
              <span className="text-text-gray">쪽수</span>
              <span className="text-white">{summary.pageCount}쪽</span>
            </div>
            <div className="px-4 py-3 flex justify-between items-baseline bg-white/5">
              <span className="text-white">예상 금액</span>
              <span className="text-accent-orange font-medium text-base">{krw(displayPrice ?? summary.priceTotal)}</span>
            </div>
          </div>
        )}

        {summary && summary.paddedPages > 0 && (
          <p className="text-sm text-yellow-200 border border-yellow-400/40 bg-yellow-400/10 px-4 py-3 leading-relaxed">
            이 판형의 최소 쪽수에 맞추려고 빈 페이지가 {summary.paddedPages}장 들어갑니다.
            본문을 더하거나 더 작은 판형·본문 크기를 고르면 빈 쪽이 줄어듭니다.
          </p>
        )}

        {summary?.advice && summary.paddedPages === 0 && (
          <p className="text-sm text-yellow-200 border border-yellow-400/40 bg-yellow-400/10 px-4 py-3 leading-relaxed">
            {summary.advice}
          </p>
        )}

        {summary && summary.notes.length > 0 && (
          <ul className="space-y-1">
            {summary.notes.map((n, i) => (
              <li key={i} className="text-xs text-text-gray leading-relaxed">· {n}</li>
            ))}
          </ul>
        )}

        {/* 표지는 쪽수가 확정된 뒤에만 만들 수 있다 — 책등 두께가 쪽수에서 나온다. */}
        {summary && (
          <div className="border-t border-white/10 pt-6 space-y-5">
            <div>
              <h2 className="text-white font-medium">표지</h2>
              <p className="text-xs text-text-gray mt-1 leading-relaxed">
                {summary.pageCount}쪽 기준으로 책등 두께를 계산해 그립니다.
                건너뛰어도 됩니다. 만들지 않으면 결제 때 아이보리 기본 표지로 인쇄합니다.
              </p>
            </div>

            <Segmented
              label="스타일"
              value={theme}
              onChange={setTheme}
              options={(["ivory", "charcoal", "photo"] as const).map((v) => ({
                value: v,
                label: THEME_LABEL[v],
              }))}
            />

            {theme === "photo" && (
              <div className="space-y-2">
                <label htmlFor="cover-img" className="block text-sm font-medium text-white">
                  앞표지 사진
                </label>
                <input
                  id="cover-img"
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={(e) => setCoverImage(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-text-gray file:mr-3 file:px-4 file:py-2 file:border file:border-white/20 file:bg-transparent file:text-white file:cursor-pointer hover:file:border-white/50"
                />
                <p className="text-xs text-text-gray">JPG · PNG, 8MB 이하. 인쇄 선명도를 위해 긴 변 2000px 이상을 권합니다.</p>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="back-text" className="block text-sm font-medium text-white">
                뒤표지 문구 <span className="text-text-gray font-normal">(선택)</span>
              </label>
              <textarea
                id="back-text"
                rows={4}
                maxLength={600}
                value={backText}
                onChange={(e) => setBackText(e.target.value)}
                placeholder="책을 소개하는 짧은 글"
                className={`${inputCls} resize-none leading-relaxed`}
              />
            </div>

            <button
              type="button"
              onClick={runCover}
              disabled={coverBusy}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 border border-accent-orange text-accent-orange font-medium hover:bg-accent-orange hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {coverBusy ? (<><Spinner /> 표지 만드는 중…</>) : coverDoc ? "표지 다시 만들기" : "표지 만들기"}
            </button>

            {coverInfo && (
              <div className="text-xs text-text-gray space-y-1 leading-relaxed">
                <p>
                  표지 {coverInfo.widthMm}×{coverInfo.heightMm}mm · 책등{" "}
                  <span className="text-white">{coverInfo.spineWidthMm}mm</span>
                </p>
                {coverInfo.notes.map((n, i) => (<p key={i}>· {n}</p>))}
              </div>
            )}
          </div>
        )}

        {summary && !wantOrder && (
          <div className="border border-white/15 bg-white/[0.03] px-4 py-5 space-y-4">
            <div>
              <p className="text-sm text-white">이 책으로 제작할까요?</p>
              <p className="text-xs text-text-gray leading-relaxed mt-1">
                미리보기가 마음에 들면 배송지를 적고 결제합니다. 워터마크는 인쇄본에 들어가지 않습니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setWantOrder(true)}
              disabled={dirty || !summary.withinSpec}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 bg-accent-orange text-white font-medium hover:bg-accent-orange/85 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              이 책으로 제작하기
            </button>
            {dirty && (
              <p className="text-xs text-yellow-200">다시 조판한 뒤에 제작을 시작할 수 있습니다.</p>
            )}
            {!summary.withinSpec && (
              <p className="text-xs text-yellow-200">이 판형으로는 제작할 수 없습니다. 본문 크기나 판형을 바꿔주세요.</p>
            )}
          </div>
        )}

        {summary && wantOrder && (
          <div className="border border-white/15 bg-white/[0.03] px-4 py-5 space-y-4 animate-studio-in motion-reduce:animate-none">
            <div>
              <p className="text-sm text-white">책으로 만들기</p>
              <p className="text-xs text-text-gray leading-relaxed mt-1">
                결제하시면 조판한 내용 그대로 인쇄·제본해 보내드립니다. 카드에 청구되는 금액은
                아래 표시 가격을 넘지 않습니다.
              </p>
            </div>
            <div className="space-y-2">
              <label htmlFor="s-email" className="block text-sm font-medium text-white">이메일</label>
              <input
                id="s-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="영수증을 받을 주소"
                className={inputCls}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="s-qty" className="block text-sm font-medium text-white">수량</label>
              <input
                id="s-qty"
                type="number"
                min={1}
                max={100}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                className={inputCls}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label htmlFor="s-recipient" className="block text-sm font-medium text-white">받는 분</label>
                <input
                  id="s-recipient"
                  type="text"
                  autoComplete="name"
                  value={shipping.recipientName}
                  onChange={(e) => setShipping({ ...shipping, recipientName: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="s-phone" className="block text-sm font-medium text-white">연락처</label>
                <input
                  id="s-phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="010-0000-0000"
                  value={shipping.recipientPhone}
                  onChange={(e) => setShipping({ ...shipping, recipientPhone: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="s-postal" className="block text-sm font-medium text-white">우편번호</label>
              <input
                id="s-postal"
                type="text"
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={5}
                placeholder="12345"
                value={shipping.postalCode}
                onChange={(e) => setShipping({ ...shipping, postalCode: e.target.value.replace(/\D/g, "") })}
                className={inputCls}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="s-addr1" className="block text-sm font-medium text-white">주소</label>
              <input
                id="s-addr1"
                type="text"
                autoComplete="address-line1"
                value={shipping.address1}
                onChange={(e) => setShipping({ ...shipping, address1: e.target.value })}
                className={inputCls}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="s-addr2" className="block text-sm font-medium text-white">
                상세 주소 <span className="text-text-gray font-normal">(선택)</span>
              </label>
              <input
                id="s-addr2"
                type="text"
                autoComplete="address-line2"
                value={shipping.address2}
                onChange={(e) => setShipping({ ...shipping, address2: e.target.value })}
                className={inputCls}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="s-memo" className="block text-sm font-medium text-white">
                배송 메모 <span className="text-text-gray font-normal">(선택)</span>
              </label>
              <input
                id="s-memo"
                type="text"
                value={shipping.memo}
                onChange={(e) => setShipping({ ...shipping, memo: e.target.value })}
                placeholder="부재 시 경비실에 맡겨주세요"
                className={inputCls}
              />
            </div>
            <button
              type="button"
              onClick={startCheckout}
              disabled={payBusy || dirty || !summary.withinSpec}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 bg-accent-orange text-white font-medium hover:bg-accent-orange/85 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {payBusy ? (
                <>
                  <Spinner /> {PAY_PHASES[payPhase]}…
                </>
              ) : (
                `${krw(displayPrice ?? summary.priceTotal)} 결제하고 제작하기`
              )}
            </button>
            {payBusy && (
              <p className="text-xs text-text-gray leading-relaxed">
                결제 전에 서버에서 조판을 한 번 더 확인합니다. 원고가 길면 1분 가까이 걸릴 수 있습니다.
              </p>
            )}
            <button
              type="button"
              onClick={() => setWantOrder(false)}
              disabled={payBusy}
              className="w-full text-xs text-text-gray hover:text-white transition-colors disabled:opacity-40"
            >
              미리보기로 돌아가기
            </button>
          </div>
        )}
      </div>

      {/* 미리보기 */}
      <div className="min-h-[28rem] sticky top-6">
        {busy ? (
          <div
            className="h-full min-h-[28rem] border border-dashed border-accent-orange/40 bg-accent-orange/5 flex flex-col items-center justify-center gap-4 text-center px-6 animate-studio-in motion-reduce:animate-none"
            aria-live="polite"
          >
            <Spinner />
            <p className="text-white">{TYPESET_PHASES[typesetPhase]}</p>
            <p className="text-xs text-text-gray leading-relaxed max-w-sm">
              실제 인쇄될 쪽을 만들고 있습니다. 원고가 길면 1분 가까이 걸릴 수 있습니다.
            </p>
          </div>
        ) : !doc ? (
          <div className="h-full min-h-[28rem] border border-dashed border-white/15 flex flex-col items-center justify-center gap-3 text-center px-6">
            <p className="text-text-gray">
              원고를 올리고 조판하면 <span className="text-white">실제 인쇄될 모습</span>을 여기서
              펼침면으로 확인할 수 있습니다.
            </p>
            <p className="text-xs text-text-gray">
              책등 두께·재단 여백·쪽수 규칙은 저희가 맞춥니다.
            </p>
          </div>
        ) : (
          <div className="space-y-5 animate-studio-in motion-reduce:animate-none">
            {coverDoc && (
              <div role="tablist" aria-label="미리보기 대상" className="flex gap-2">
                {([["inner", "내지"], ["cover", "표지"]] as const).map(([key, label]) => (
                  <button
                    key={key}
                    role="tab"
                    aria-selected={tab === key}
                    onClick={() => setTab(key)}
                    className={`px-5 py-2 text-sm border transition-colors ${
                      tab === key
                        ? "border-accent-orange bg-accent-orange/10 text-white"
                        : "border-white/15 text-text-gray hover:text-white hover:border-white/40"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {tab === "cover" && coverDoc ? (
              <div className="space-y-5">
                <div className="flex justify-center bg-black/30 border border-white/10 p-4 sm:p-8">
                  {/* 표지는 펼침면 1장이라 그대로 보여준다. */}
                  <PageCanvas doc={coverDoc} pageNumber={1} scale={0.44} />
                </div>
                <p className="text-xs text-text-gray text-center leading-relaxed">
                  왼쪽부터 뒤표지 · 책등 · 앞표지입니다. 인쇄 후 접히는 형태 그대로입니다.
                </p>
              </div>
            ) : (
              <>
            {/* 좁은 화면에서는 두 쪽을 나란히 두면 각 쪽이 절반으로 줄어 읽을 수 없다.
                세로로 쌓아 한 쪽씩 화면 폭에 맞춘다. */}
            <div
              key={spread}
              className="flex flex-col sm:flex-row items-center sm:items-start justify-center gap-4 sm:gap-1 bg-black/30 border border-white/10 p-4 sm:p-8 animate-studio-in motion-reduce:animate-none"
            >
              <PageCanvas doc={doc} pageNumber={leftPage} scale={0.62} />
              <PageCanvas doc={doc} pageNumber={rightPage} scale={0.62} />
            </div>

            <div className="flex items-center justify-center gap-4">
              <button type="button" onClick={() => setSpread((s) => Math.max(0, s - 1))}
                disabled={spread === 0}
                className="px-4 py-2 border border-white/20 text-text-gray hover:text-white hover:border-white/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                ← 이전
              </button>
              <span className="text-sm text-text-gray tabular-nums">
                {spread === 0 ? "1" : `${leftPage}–${Math.min(rightPage, doc.numPages)}`} / {doc.numPages}쪽
              </span>
              <button type="button" onClick={() => setSpread((s) => Math.min(totalSpreads - 1, s + 1))}
                disabled={spread >= totalSpreads - 1}
                className="px-4 py-2 border border-white/20 text-text-gray hover:text-white hover:border-white/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                다음 →
              </button>
            </div>

            <p className="text-xs text-text-gray text-center leading-relaxed">
              실제 인쇄에 쓰이는 PDF를 그대로 보여드립니다. 본문 크기나 장 시작 방식을 바꾸면
              쪽수와 금액이 함께 달라집니다.
            </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
