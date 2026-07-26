"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
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
    let task: { cancel: () => void } | null = null
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
    })

    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [doc, pageNumber, scale])

  if (!doc || pageNumber < 1 || pageNumber > doc.numPages) {
    // 펼침면의 빈 자리(표지 안쪽 등)는 자리만 잡아 균형을 유지한다.
    return <div aria-hidden className="bg-white/5 border border-white/5" style={{ width: 210, height: 297 }} />
  }
  return <canvas ref={ref} className="bg-white shadow-2xl" aria-label={`${pageNumber}쪽`} />
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
      className="inline-block h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin"
    />
  )
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

  const spec = specs.find((s) => s.bookSpecUid === specUid)

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
    } catch {
      setError("조판 중 문제가 생겼습니다. 다시 시도해주세요.")
    } finally {
      setBusy(false)
    }
  }, [file, specUid, textSize, chapterNewPage, title, authorName])

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
              if (f) setFile(f)
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
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
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
          {busy ? (<><Spinner /> 조판 중…</>) : doc ? "다시 조판하기" : "조판해서 미리보기 →"}
        </button>

        {error && (
          <div role="alert" className="border border-red-400/40 bg-red-400/10 px-4 py-3">
            <p className="text-sm text-red-300 leading-relaxed">{error}</p>
          </div>
        )}

        {summary && (
          <div className="border border-white/15 divide-y divide-white/10 text-sm">
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
              <span className="text-accent-orange font-medium text-base">{krw(summary.priceTotal)}</span>
            </div>
          </div>
        )}

        {summary?.advice && (
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

        {/* 결제 연동 전이라 주문 버튼이 없다. 없는 이유를 여기서 밝힌다. */}
        {summary && (
          <div className="border border-white/15 bg-white/[0.03] px-4 py-4 space-y-2">
            <p className="text-sm text-white flex items-center gap-2">
              <span className="text-xs border border-accent-orange/50 text-accent-orange px-2 py-0.5">
                준비중
              </span>
              온라인 주문 · 결제
            </p>
            <p className="text-xs text-text-gray leading-relaxed">
              결제 연동을 준비하고 있습니다. 지금은 조판 결과를 미리보기로 확인하실 수 있고,
              실제 제작은 문의로 도와드립니다.
            </p>
            {/* 워터마크는 반드시 먼저 설명한다. 묻기 전에 답이 있어야 문의가 줄어든다. */}
            <p className="text-xs text-text-gray/70 leading-relaxed">
              미리보기에는 워터마크가 들어갑니다. 주문하시면 워터마크 없는 인쇄본으로 제작됩니다.
            </p>
          </div>
        )}
      </div>

      {/* 미리보기 */}
      <div className="min-h-[28rem]">
        {!doc ? (
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
          <div className="space-y-5">
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
                <div className="flex justify-center bg-black/30 border border-white/10 p-4 sm:p-8 overflow-x-auto">
                  {/* 표지는 펼침면 1장이라 그대로 보여준다. */}
                  <PageCanvas doc={coverDoc} pageNumber={1} scale={0.44} />
                </div>
                <p className="text-xs text-text-gray text-center leading-relaxed">
                  왼쪽부터 뒤표지 · 책등 · 앞표지입니다. 인쇄 후 접히는 형태 그대로입니다.
                </p>
              </div>
            ) : (
              <>
            <div className="flex items-start justify-center gap-1 bg-black/30 border border-white/10 p-4 sm:p-8 overflow-x-auto">
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
