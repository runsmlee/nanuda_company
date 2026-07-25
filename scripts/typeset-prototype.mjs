// 조판 프로토타입 검증.
//
// 실제 원고(『길에서 만나다』 온라인 공개본)를 조판해 A5 인쇄용 PDF를 만들고,
// SweetBook 샌드박스에 올려 동기 검증을 실제로 통과하는지 확인한다.
// 문서상 통과가 아니라 제작사 서버가 받아주는지가 유일한 증거다.
//
// 실행: node scripts/typeset-prototype.mjs [--upload]

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import PDFDocument from "pdfkit"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const OUT = path.join(ROOT, ".typeset-out")
const SPEC = "PHOTOBOOK_A5_SC"

// ── typeset.ts와 동일한 로직 (TS 런타임 없이 검증하기 위한 실행 사본) ──────────
const mmToPt = (mm) => mm / (25.4 / 72)
const TEXT_SIZES = {
  small: { fontSize: 9.5, lineGap: 4.2 },
  normal: { fontSize: 10.5, lineGap: 5.0 },
  large: { fontSize: 11.5, lineGap: 6.0 },
}
const GUTTER_MM = 18, OUTER_MM = 14, TOP_MM = 18, BOTTOM_MM = 20

async function typeset(chapters, opts) {
  const notes = []
  const size = TEXT_SIZES[opts.textSize]
  const pageWpt = mmToPt(opts.trimWidthMm + opts.bleedMm * 2)
  const pageHpt = mmToPt(opts.trimHeightMm + opts.bleedMm * 2)
  const bleedPt = mmToPt(opts.bleedMm)

  const doc = new PDFDocument({
    size: [pageWpt, pageHpt], margin: 0, autoFirstPage: false, bufferPages: true,
    info: { Title: opts.title, Author: opts.authorName },
  })
  const chunks = []
  doc.on("data", (c) => chunks.push(c))
  const done = new Promise((r) => doc.on("end", () => r(Buffer.concat(chunks))))

  doc.registerFont("body", path.join(ROOT, "assets/fonts/NanumMyeongjo-Regular.ttf"))
  doc.registerFont("head", path.join(ROOT, "assets/fonts/NanumMyeongjo-Bold.ttf"))

  let pageIndex = 0
  const addPage = () => { doc.addPage({ size: [pageWpt, pageHpt], margin: 0 }); pageIndex += 1 }
  const contentBox = () => {
    const isRight = pageIndex % 2 === 1
    const left = bleedPt + mmToPt(isRight ? GUTTER_MM : OUTER_MM)
    const right = bleedPt + mmToPt(isRight ? OUTER_MM : GUTTER_MM)
    return { x: left, y: bleedPt + mmToPt(TOP_MM), width: pageWpt - left - right, bottom: pageHpt - bleedPt - mmToPt(BOTTOM_MM) }
  }

  addPage()
  let box = contentBox(), cursor = box.y
  const breakPage = () => { addPage(); box = contentBox(); cursor = box.y }

  for (const [ci, ch] of chapters.entries()) {
    if (opts.chapterStartsNewPage && (ci > 0 || cursor > box.y)) breakPage()
    if (ch.title) {
      doc.font("head").fontSize(size.fontSize + 4)
      const h = doc.heightOfString(ch.title, { width: box.width })
      if (cursor + h + mmToPt(8) > box.bottom) breakPage()
      doc.fillColor("#000").text(ch.title, box.x, cursor, { width: box.width, align: "left" })
      cursor += h + mmToPt(8)
    }
    doc.font("body").fontSize(size.fontSize).fillColor("#000")
    for (const para of ch.paragraphs) {
      if (!para.trim()) continue
      let rem = para, guard = 0, cont = false
      while (rem && guard++ < 500) {
        const o = { width: box.width, align: "justify", lineGap: size.lineGap, indent: cont ? 0 : mmToPt(3) }
        const avail = box.bottom - cursor
        const full = doc.heightOfString(rem, o)
        if (full <= avail) { doc.text(rem, box.x, cursor, o); cursor += full + size.lineGap; break }
        if (avail < size.fontSize * 3) { breakPage(); continue }
        let lo = 0, hi = rem.length
        while (lo < hi) {
          const mid = Math.ceil((lo + hi) / 2)
          if (doc.heightOfString(rem.slice(0, mid), o) <= avail) lo = mid; else hi = mid - 1
        }
        let cut = lo
        const sp = rem.lastIndexOf(" ", cut)
        if (sp > cut * 0.6) cut = sp
        if (cut <= 0) cut = Math.max(1, lo)
        doc.text(rem.slice(0, cut), box.x, cursor, o)
        rem = rem.slice(cut).trimStart()
        cont = true
        breakPage()
      }
    }
  }

  let padded = 0
  const needsMore = () => pageIndex < opts.pageMin || (pageIndex - opts.pageMin) % opts.pageIncrement !== 0
  while (needsMore() && pageIndex < opts.pageMax) { addPage(); padded += 1 }

  const total = pageIndex
  const withinSpec = total >= opts.pageMin && total <= opts.pageMax && (total - opts.pageMin) % opts.pageIncrement === 0
  if (total > opts.pageMax) notes.push(`${total}p — 상한 ${opts.pageMax}p 초과`)
  if (padded) notes.push(`빈 페이지 ${padded}장 추가로 ${opts.pageIncrement}p 단위 정렬`)

  const range = doc.bufferedPageRange()
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i)
    const isRight = (i + 1) % 2 === 1
    doc.font("body").fontSize(8.5).fillColor("#555")
    doc.text(String(i + 1), bleedPt + mmToPt(isRight ? GUTTER_MM : OUTER_MM), pageHpt - bleedPt - mmToPt(12), {
      width: pageWpt - bleedPt * 2 - mmToPt(OUTER_MM + GUTTER_MM),
      align: isRight ? "right" : "left", lineBreak: false,
    })
  }
  doc.end()
  return { pdf: await done, pageCount: total, paddedPages: padded, withinSpec, notes }
}

// ── 원고 전처리 ───────────────────────────────────────────────────────────
const HANGUL = /[\u3131-\u318E\uAC00-\uD7A3\u4E00-\u9FFF]/
const SENTENCE_END = /[.!?\u3002\u2026"'\u300d\u300f\u3009\u00b7,;:)\]]$/
// 한글은 어절 중간에서도 줄바꿈되므로 무조건 공백으로 합치면 어절이 깨진다.
function joinWrappedLines(lines) {
  return lines.reduce((acc, raw) => {
    const line = String(raw).trim()
    if (!line) return acc
    if (!acc) return line
    const stuck = !SENTENCE_END.test(acc) && HANGUL.test(acc[acc.length - 1]) && HANGUL.test(line[0])
    return acc + (stuck ? "" : " ") + line
  }, "")
}

// ── 원고 로드: 실제 책 본문 ────────────────────────────────────────────────
function loadManuscript() {
  const dir = path.join(ROOT, "content/book-reader/gil-eseo-mannada")
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "index.json")
  const docs = files.map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")))
    .filter((d) => Array.isArray(d.blocks))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  let chars = 0
  const chapters = docs.map((d) => {
    // blocks의 각 항목은 원본 PDF의 줄 배열. 줄을 합쳐 문단으로 복원한다.
    const paragraphs = d.blocks
      .map((b) => (Array.isArray(b) ? joinWrappedLines(b) : String(b)))
      .map((s) => s.replace(/\s+/g, " ").trim())
      .filter(Boolean)
    paragraphs.forEach((p) => (chars += p.length))
    return { title: d.title || "", paragraphs }
  })
  return { chapters, chars, chapterCount: chapters.length }
}

// ── PDF 실측 검증 ──────────────────────────────────────────────────────────
function inspectPdf(buf) {
  const s = buf.toString("latin1")
  const boxes = [...s.matchAll(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/g)]
  const sizes = new Set(boxes.map((m) => {
    const w = (parseFloat(m[3]) - parseFloat(m[1])) * 25.4 / 72
    const h = (parseFloat(m[4]) - parseFloat(m[2])) * 25.4 / 72
    return `${w.toFixed(2)}x${h.toFixed(2)}`
  }))
  const counts = [...s.matchAll(/\/Type\s*\/Pages[^>]*?\/Count\s+(\d+)/g)].map((m) => +m[1])
  return { distinctSizes: [...sizes], declaredCount: counts.length ? Math.max(...counts) : null, mediaBoxes: boxes.length }
}

// ── 실행 ──────────────────────────────────────────────────────────────────
const KEY = process.env.SWEETBOOK_API_KEY
const BASE = process.env.SWEETBOOK_API_BASE || "https://api-sandbox.sweetbook.com/v1"

async function sb(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${KEY}`, ...(init.headers || {}) },
  })
  const body = await res.json().catch(() => ({}))
  return { ok: res.ok && body.success !== false, status: res.status, body }
}

const main = async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const { chapters, chars, chapterCount } = loadManuscript()
  console.log(`원고: ${chapterCount}개 장, ${chars.toLocaleString()}자\n`)

  if (!KEY) { console.error("SWEETBOOK_API_KEY 필요 (.env.local 로드 후 실행)"); process.exit(1) }

  const specRes = await sb(`/book-specs/${SPEC}`)
  if (!specRes.ok) { console.error("판형 조회 실패:", specRes.body); process.exit(1) }
  const spec = specRes.body.data
  console.log(`판형: ${spec.name} — 내지 ${spec.innerTrimWidthMm}x${spec.innerTrimHeightMm}mm, ${spec.pageMin}~${spec.pageMax}p, ${spec.pageIncrement}p 단위, 도련 ${spec.bleedMm}mm\n`)

  const results = []
  for (const textSize of ["small", "normal", "large"]) {
    const r = await typeset(chapters, {
      trimWidthMm: spec.innerTrimWidthMm, trimHeightMm: spec.innerTrimHeightMm, bleedMm: spec.bleedMm,
      textSize, pageIncrement: spec.pageIncrement, pageMin: spec.pageMin, pageMax: spec.pageMax,
      chapterStartsNewPage: true, title: "길에서 만나다", authorName: "이상민",
    })
    const file = path.join(OUT, `inner-${textSize}.pdf`)
    fs.writeFileSync(file, r.pdf)
    const ins = inspectPdf(r.pdf)
    results.push({ textSize, ...r, ins, file })
    console.log(`[${textSize}] ${r.pageCount}p (빈 ${r.paddedPages}) 규격내=${r.withinSpec} 크기=${ins.distinctSizes.join(",")} ${(r.pdf.length/1024/1024).toFixed(1)}MB`)
    r.notes.forEach((n) => console.log(`   · ${n}`))
  }

  if (!process.argv.includes("--upload")) {
    console.log(`\n결과: ${OUT}\n제작사 검증까지 하려면 --upload`)
    return
  }

  // 실제 검증: 제작사가 받아주는가
  const pick = results.find((r) => r.withinSpec) || results[0]
  console.log(`\n=== SweetBook 업로드 검증 (${pick.textSize}, ${pick.pageCount}p) ===`)

  const create = await sb("/books", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": `proto-${Date.now()}` },
    body: JSON.stringify({ title: `조판 프로토타입 ${pick.pageCount}p`, bookSpecUid: SPEC, creationType: "PDF_UPLOAD", pageCount: pick.pageCount }),
  })
  if (!create.ok) { console.error("책 생성 실패:", JSON.stringify(create.body, null, 1)); process.exit(1) }
  const bookUid = create.body.data.bookUid
  console.log(`책 생성: ${bookUid}`)

  const form = new FormData()
  form.set("file", new Blob([pick.pdf], { type: "application/pdf" }), "inner.pdf")
  const up = await sb(`/books/${bookUid}/pdf-contents`, { method: "POST", body: form })
  console.log(`내지 업로드: ${up.status}`)
  console.log(JSON.stringify(up.body.data ?? up.body, null, 1))
  if (!up.ok) process.exit(1)
  console.log("\n✅ 제작사 동기 검증 통과 — 조판 결과가 실제 인쇄 가능")
}

main().catch((e) => { console.error(e); process.exit(1) })
