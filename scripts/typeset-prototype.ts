// 조판 파이프라인 검증.
//
// 저자 원고(.docx) → 파싱 → 조판 → 인쇄용 내지 PDF → SweetBook 동기 검증.
// 문서상 통과가 아니라 제작사 서버가 받아주는지가 유일한 증거다.
//
// 실행: pnpm typeset:check [파일경로] [--upload]

import fs from "node:fs"
import path from "node:path"
import { parseManuscriptFile, type ParsedManuscript } from "../lib/publishing/manuscript"
import { fitToSpec, typeset, TEXT_SIZES, type Chapter, type TextSize } from "../lib/publishing/typeset"

const ROOT = process.cwd()
const OUT = path.join(ROOT, ".typeset-out")
const SPEC = "PHOTOBOOK_A5_SC"

const KEY = process.env.SWEETBOOK_API_KEY
const BASE = process.env.SWEETBOOK_API_BASE || "https://api-sandbox.sweetbook.com/v1"

async function sb(p: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${p}`, {
    ...init,
    headers: { Authorization: `Bearer ${KEY}`, ...(init.headers as Record<string, string>) },
  })
  const body = await res.json().catch(() => ({}))
  return { ok: res.ok && body.success !== false, status: res.status, body }
}

/** PDF에 선언된 페이지 크기를 실측한다. 조판이 규격을 지켰는지 코드 밖에서 확인. */
function inspectPdf(buf: Buffer) {
  const s = buf.toString("latin1")
  const sizes = new Set(
    [...s.matchAll(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/g)].map((m) => {
      const w = ((+m[3] - +m[1]) * 25.4) / 72
      const h = ((+m[4] - +m[2]) * 25.4) / 72
      return `${w.toFixed(2)}x${h.toFixed(2)}`
    }),
  )
  return [...sizes]
}

/** 인자로 파일을 주지 않으면 레포의 실제 책 본문을 원고 대신 쓴다. */
function fallbackManuscript(): ParsedManuscript {
  const dir = path.join(ROOT, "content/book-reader/gil-eseo-mannada")
  const docs = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json") && f !== "index.json")
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")))
    .filter((d) => Array.isArray(d.blocks))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  let charCount = 0
  let paragraphCount = 0
  const chapters: Chapter[] = docs.map((d) => {
    const paragraphs = (d.blocks as unknown[])
      .map((b) => (Array.isArray(b) ? b.join(" ") : String(b)))
      .map((s) => s.replace(/\s+/g, " ").trim())
      .filter(Boolean)
    paragraphs.forEach((p) => {
      charCount += p.length
      paragraphCount += 1
    })
    return { title: d.title || "", paragraphs }
  })
  return { chapters, charCount, paragraphCount, notes: ["레포 본문을 원고 대신 사용"] }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const args = process.argv.slice(2)
  const file = args.find((a) => !a.startsWith("--"))
  const upload = args.includes("--upload")

  let parsed: ParsedManuscript
  if (file) {
    const buf = fs.readFileSync(file)
    parsed = await parseManuscriptFile(path.basename(file), buf)
    console.log(`원고: ${path.basename(file)} (${(buf.length / 1024).toFixed(0)}KB)`)
  } else {
    parsed = fallbackManuscript()
    console.log("원고: (인자 없음 — 레포 본문 사용)")
  }

  console.log(`  장 ${parsed.chapters.length}개 · 문단 ${parsed.paragraphCount}개 · ${parsed.charCount.toLocaleString()}자`)
  parsed.notes.forEach((n) => console.log(`  · ${n}`))
  console.log(`  첫 장: "${parsed.chapters[0]?.title || "(제목 없음)"}"`)
  console.log(`  첫 문단: ${parsed.chapters[0]?.paragraphs[0]?.slice(0, 60) ?? ""}…\n`)

  if (!KEY) {
    console.error("SWEETBOOK_API_KEY 필요 (.env.local 로드 후 실행)")
    process.exit(1)
  }

  const specRes = await sb(`/book-specs/${SPEC}`)
  if (!specRes.ok) {
    console.error("판형 조회 실패:", specRes.body)
    process.exit(1)
  }
  const spec = specRes.body.data
  console.log(`판형: ${spec.name} — ${spec.innerTrimWidthMm}x${spec.innerTrimHeightMm}mm, ${spec.pageMin}~${spec.pageMax}p, ${spec.pageIncrement}p 단위\n`)

  // 업로드 전에 판형 적합성부터 판정한다. 저자에게 보여줄 안내와 같은 로직.
  const fit = fitToSpec(parsed.charCount, spec)
  console.log("판형 적합성 (글자 수 기반 추정):")
  fit.options.forEach((o) => console.log(`  ${TEXT_SIZES[o.textSize].label}: ~${o.pages}p ${o.ok ? "✓" : "✗"}`))
  if (!fit.fits) console.log(`  → ${fit.advice}`)
  console.log()

  const results: { textSize: TextSize; pageCount: number; withinSpec: boolean; pdf: Buffer }[] = []
  for (const textSize of Object.keys(TEXT_SIZES) as TextSize[]) {
    const r = await typeset(parsed.chapters, {
      trimWidthMm: spec.innerTrimWidthMm,
      trimHeightMm: spec.innerTrimHeightMm,
      bleedMm: spec.bleedMm,
      textSize,
      pageIncrement: spec.pageIncrement,
      pageMin: spec.pageMin,
      pageMax: spec.pageMax,
      chapterStartsNewPage: true,
      title: "조판 검증",
      authorName: "나누다컴퍼니",
    })
    fs.writeFileSync(path.join(OUT, `inner-${textSize}.pdf`), r.pdf)
    console.log(`[${textSize}] ${r.pageCount}p (빈 ${r.paddedPages}) 규격내=${r.withinSpec} 크기=${inspectPdf(r.pdf).join(",")}`)
    r.notes.forEach((n) => console.log(`   · ${n}`))
    results.push({ textSize, pageCount: r.pageCount, withinSpec: r.withinSpec, pdf: r.pdf })
  }

  // 추정과 실측이 얼마나 벌어지는지 — estimatePages 상수 보정 근거.
  console.log("\n추정 vs 실측:")
  fit.options.forEach((o) => {
    const actual = results.find((r) => r.textSize === o.textSize)!.pageCount
    const diff = (((actual - o.pages) / actual) * 100).toFixed(1)
    console.log(`  ${o.textSize}: 추정 ${o.pages}p / 실측 ${actual}p (${diff}%)`)
  })

  if (!upload) {
    console.log(`\n결과: ${OUT}\n제작사 검증까지 하려면 --upload`)
    return
  }

  const pick = results.find((r) => r.withinSpec) ?? results[0]
  console.log(`\n=== SweetBook 업로드 검증 (${pick.textSize}, ${pick.pageCount}p) ===`)

  const create = await sb("/books", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": `proto-${Date.now()}` },
    body: JSON.stringify({
      title: `조판 검증 ${pick.pageCount}p`,
      bookSpecUid: SPEC,
      creationType: "PDF_UPLOAD",
      pageCount: pick.pageCount,
    }),
  })
  if (!create.ok) {
    console.error("책 생성 실패:", JSON.stringify(create.body, null, 1))
    process.exit(1)
  }
  const bookUid = create.body.data.bookUid
  console.log(`책 생성: ${bookUid}`)

  const form = new FormData()
  form.set("file", new Blob([new Uint8Array(pick.pdf)], { type: "application/pdf" }), "inner.pdf")
  const up = await sb(`/books/${bookUid}/pdf-contents`, { method: "POST", body: form })
  console.log(`내지 업로드: ${up.status}`)
  console.log(JSON.stringify(up.body.data ?? up.body, null, 1))
  if (!up.ok) process.exit(1)
  console.log("\n✅ 제작사 동기 검증 통과 — 조판 결과가 실제 인쇄 가능")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
