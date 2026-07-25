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
const krw = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`

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
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const spec = specs.find((s) => s.bookSpecUid === specUid)

  // blob URL은 반드시 회수한다. 조판을 반복하면 금방 쌓인다.
  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl) }, [pdfUrl])

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

      if (pdfUrl) URL.revokeObjectURL(pdfUrl)
      setPdfUrl(URL.createObjectURL(blob))
      setDoc(loaded as unknown as PdfDoc)
      setSummary(parsedSummary)
      setSpread(0)
    } catch {
      setError("조판 중 문제가 생겼습니다. 다시 시도해주세요.")
    } finally {
      setBusy(false)
    }
  }, [file, specUid, textSize, chapterNewPage, title, authorName, pdfUrl])

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

        {pdfUrl && (
          <a href={pdfUrl} download={`${title || "원고"}-내지.pdf`}
            className="inline-block text-sm text-accent-orange hover:underline">
            ↓ 인쇄용 PDF 내려받기
          </a>
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
          </div>
        )}
      </div>
    </div>
  )
}
