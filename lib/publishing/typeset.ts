// 원고 → 인쇄용 내지 PDF 조판.
//
// 저자는 인쇄용 PDF를 만들 수 없다. 그 간극을 메우는 것이 이 서비스의 핵심이다.
// 여기서 만든 PDF가 SweetBook의 동기 검증(크기 mm, 페이지 수)을 그대로 통과해야 한다.
//
// 제약: 페이지 수는 판형의 pageMin~pageMax 범위 안에서 pageIncrement의 배수여야 한다.
// (A5 소프트커버 = 50~200p, 2p 단위) 조판 결과가 딱 떨어지지 않으므로 빈 페이지로 맞춘다.

import { join } from "node:path"
import PDFDocument from "pdfkit"

const MM_PER_PT = 25.4 / 72
export const mmToPt = (mm: number) => mm / MM_PER_PT

/** 본문 크기 프리셋. 저자에게는 "작게/보통/크게"로만 노출하고 페이지 수 조절 레버로 쓴다. */
export const TEXT_SIZES = {
  small: { fontSize: 9.5, lineGap: 4.2, label: "작게" },
  normal: { fontSize: 10.5, lineGap: 5.0, label: "보통" },
  large: { fontSize: 11.5, lineGap: 6.0, label: "크게" },
} as const

export type TextSize = keyof typeof TEXT_SIZES

export interface TypesetOptions {
  /** 재단 후 내지 크기(mm). PDF는 여기에 도련이 더해진 크기로 나온다. */
  trimWidthMm: number
  trimHeightMm: number
  bleedMm: number
  textSize: TextSize
  /** 페이지 수를 이 배수로 맞춘다. */
  pageIncrement: number
  pageMin: number
  pageMax: number
  /** 장을 항상 새 페이지에서 시작할지. */
  chapterStartsNewPage: boolean
  title: string
  authorName: string
}

export interface Chapter {
  title: string
  paragraphs: string[]
}

export interface TypesetResult {
  pdf: Buffer
  pageCount: number
  /** 빈 페이지로 채운 수. 저자에게 보여줄 필요는 없지만 진단에 쓴다. */
  paddedPages: number
  withinSpec: boolean
  notes: string[]
}

/** 제본되는 안쪽 여백은 바깥보다 넓게 잡는다 (PUR 무선제본은 안쪽이 말려 들어간다). */
const GUTTER_MM = 18
const OUTER_MM = 14
const TOP_MM = 18
const BOTTOM_MM = 20

const FONT_REGULAR = "assets/fonts/NanumMyeongjo-Regular.ttf"
const FONT_BOLD = "assets/fonts/NanumMyeongjo-Bold.ttf"

/**
 * 원고를 조판해 내지 PDF를 만든다.
 * fontDir로 폰트 경로 기준을 바꿀 수 있다 (스크립트/서버 실행 경로 차이 대응).
 */
export async function typeset(
  chapters: Chapter[],
  opts: TypesetOptions,
  fontDir = process.cwd(),
): Promise<TypesetResult> {
  const notes: string[] = []
  const size = TEXT_SIZES[opts.textSize]

  const pageWpt = mmToPt(opts.trimWidthMm + opts.bleedMm * 2)
  const pageHpt = mmToPt(opts.trimHeightMm + opts.bleedMm * 2)
  const bleedPt = mmToPt(opts.bleedMm)

  const bodyFont = join(fontDir, FONT_REGULAR)
  const doc = new PDFDocument({
    size: [pageWpt, pageHpt],
    margin: 0,
    autoFirstPage: false,
    bufferPages: true,
    // 초기 폰트를 지정하지 않으면 pdfkit이 기본 Helvetica의 .afm을 찾는데,
    // 번들된 환경에서는 그 경로가 존재하지 않아 ENOENT로 죽는다.
    font: bodyFont,
    info: { Title: opts.title, Author: opts.authorName },
  })

  const chunks: Buffer[] = []
  doc.on("data", (c: Buffer) => chunks.push(c))
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))))

  doc.registerFont("body", bodyFont)
  doc.registerFont("head", join(fontDir, FONT_BOLD))

  let pageIndex = 0
  const addPage = () => {
    doc.addPage({ size: [pageWpt, pageHpt], margin: 0 })
    pageIndex += 1
  }

  /** 홀수 페이지(오른쪽 면)는 제본변이 왼쪽, 짝수 페이지는 오른쪽. */
  const contentBox = () => {
    const isRightPage = pageIndex % 2 === 1
    const left = bleedPt + mmToPt(isRightPage ? GUTTER_MM : OUTER_MM)
    const right = bleedPt + mmToPt(isRightPage ? OUTER_MM : GUTTER_MM)
    return {
      x: left,
      y: bleedPt + mmToPt(TOP_MM),
      width: pageWpt - left - right,
      bottom: pageHpt - bleedPt - mmToPt(BOTTOM_MM),
    }
  }

  addPage()
  let box = contentBox()
  let cursor = box.y

  const breakPage = () => {
    addPage()
    box = contentBox()
    cursor = box.y
  }

  for (const [ci, chapter] of chapters.entries()) {
    if (opts.chapterStartsNewPage && (ci > 0 || cursor > box.y)) breakPage()

    if (chapter.title) {
      const headSize = size.fontSize + 4
      doc.font("head").fontSize(headSize)
      const h = doc.heightOfString(chapter.title, { width: box.width })
      if (cursor + h + mmToPt(8) > box.bottom) breakPage()
      doc.fillColor("#000").text(chapter.title, box.x, cursor, { width: box.width, align: "left" })
      cursor += h + mmToPt(8)
    }

    doc.font("body").fontSize(size.fontSize).fillColor("#000")
    for (const para of chapter.paragraphs) {
      if (!para.trim()) continue
      let remaining = para
      let isContinuation = false
      let guard = 0
      // 문단이 페이지를 넘길 수 있으므로 남은 공간에 들어가는 만큼 그리고 넘기며 반복한다.
      while (remaining && guard++ < 500) {
        // 페이지를 넘겨 이어지는 조각은 새 문단이 아니므로 들여쓰지 않는다.
        const textOpts = {
          width: box.width,
          align: "justify" as const,
          lineGap: size.lineGap,
          indent: isContinuation ? 0 : mmToPt(3),
        }
        const avail = box.bottom - cursor
        const full = doc.heightOfString(remaining, textOpts)
        if (full <= avail) {
          doc.text(remaining, box.x, cursor, textOpts)
          cursor += full + size.lineGap
          break
        }
        if (avail < size.fontSize * 3) {
          breakPage()
          continue
        }
        // 들어갈 만큼만 이분탐색으로 잘라 넣고, 어절 경계로 보정한다.
        let lo = 0
        let hi = remaining.length
        while (lo < hi) {
          const mid = Math.ceil((lo + hi) / 2)
          if (doc.heightOfString(remaining.slice(0, mid), textOpts) <= avail) lo = mid
          else hi = mid - 1
        }
        let cut = lo
        const sp = remaining.lastIndexOf(" ", cut)
        if (sp > cut * 0.6) cut = sp
        if (cut <= 0) cut = Math.max(1, lo)
        doc.text(remaining.slice(0, cut), box.x, cursor, textOpts)
        remaining = remaining.slice(cut).trimStart()
        isContinuation = true
        breakPage()
      }
    }
  }

  // 판형 규칙에 맞을 때까지 빈 페이지를 더한다.
  let paddedPages = 0
  const needsMore = () =>
    pageIndex < opts.pageMin || (pageIndex - opts.pageMin) % opts.pageIncrement !== 0
  while (needsMore() && pageIndex < opts.pageMax) {
    addPage()
    paddedPages += 1
  }

  const totalPages = pageIndex
  const withinSpec =
    totalPages >= opts.pageMin &&
    totalPages <= opts.pageMax &&
    (totalPages - opts.pageMin) % opts.pageIncrement === 0

  if (totalPages > opts.pageMax) {
    notes.push(
      `조판 결과 ${totalPages}p로 판형 상한(${opts.pageMax}p)을 넘습니다. 본문 크기를 줄이거나 분권이 필요합니다.`,
    )
  }
  if (paddedPages > 0) {
    notes.push(`판형 규칙(${opts.pageIncrement}p 단위)에 맞추려고 빈 페이지 ${paddedPages}장을 더했습니다.`)
  }

  // 페이지 번호는 전체 페이지 수를 안 뒤에 바깥쪽 하단에 찍는다.
  const range = doc.bufferedPageRange()
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i)
    const isRight = (i + 1) % 2 === 1
    doc.font("body").fontSize(8.5).fillColor("#555")
    const w = pageWpt - bleedPt * 2 - mmToPt(OUTER_MM + GUTTER_MM)
    doc.text(String(i + 1), bleedPt + mmToPt(isRight ? GUTTER_MM : OUTER_MM), pageHpt - bleedPt - mmToPt(12), {
      width: w,
      align: isRight ? "right" : "left",
      lineBreak: false,
    })
  }

  doc.end()
  const pdf = await done

  return { pdf, pageCount: totalPages, paddedPages, withinSpec, notes }
}

const HANGUL = /[ㄱ-ㆎ가-힣一-鿿]/
/** 문장부호로 끝난 줄은 어절이 이어질 수 없으므로 반드시 띄운다. */
const SENTENCE_END = /[.!?。…"'」』〉·,;:)\]]$/

/**
 * 문단 안에서 줄을 이어 붙인다.
 *
 * 한글은 줄바꿈이 어절 중간에서도 일어나므로 무조건 공백으로 합치면
 * "남자" + "가" → "남자 가" 처럼 어절이 깨진다. PDF·한글 문서에서 복사한
 * 원고에 흔한 문제라 반드시 처리해야 한다.
 * 양쪽 경계가 모두 한글·한자면 붙이고, 그 외(영문·숫자)는 공백을 넣는다.
 */
export function joinWrappedLines(lines: string[]): string {
  return lines.reduce((acc, raw) => {
    const line = raw.trim()
    if (!line) return acc
    if (!acc) return line
    const prev = acc[acc.length - 1]
    const next = line[0]
    const stuck = !SENTENCE_END.test(acc) && HANGUL.test(prev) && HANGUL.test(next)
    return acc + (stuck ? "" : " ") + line
  }, "")
}

/**
 * 원고 텍스트를 장·문단으로 나눈다.
 * 실제 저자 원고는 임의 줄바꿈이 섞여 있으므로, 빈 줄을 문단 경계로 보고
 * 문단 안의 줄바꿈은 위 규칙으로 합친다.
 */
export function parseManuscript(raw: string): Chapter[] {
  const lines = raw.replace(/\r\n?/g, "\n").split("\n")
  const chapters: Chapter[] = []
  let current: Chapter | null = null
  let buf: string[] = []

  const flushPara = () => {
    const text = joinWrappedLines(buf).replace(/\s+/g, " ").trim()
    buf = []
    if (!text) return
    if (!current) current = { title: "", paragraphs: [] }
    current.paragraphs.push(text)
  }
  const flushChapter = () => {
    flushPara()
    if (current && (current.title || current.paragraphs.length)) chapters.push(current)
    current = null
  }

  for (const line of lines) {
    const t = line.trim()
    const head = /^#{1,3}\s+(.*)$/.exec(t)
    if (head) {
      flushChapter()
      current = { title: head[1].trim(), paragraphs: [] }
      continue
    }
    if (!t) {
      flushPara()
      continue
    }
    buf.push(t)
  }
  flushChapter()
  return chapters
}

/**
 * 원고 글자 수로 예상 페이지 수를 어림한다. 업로드 직후 판형 적합성을 알려주는 용도.
 * 상수는 실제 원고(112,133자)를 A5로 조판한 실측값에서 얻었다.
 * small 110p / normal 132p / large 160p → 각각 1019 / 849 / 700자.
 */
export function estimatePages(charCount: number, textSize: TextSize): number {
  const perPage = { small: 1019, normal: 849, large: 700 }[textSize]
  return Math.max(1, Math.ceil(charCount / perPage))
}

export interface FitOption {
  textSize: TextSize
  /** 빈 페이지 채움까지 반영한 최종 예상 쪽수. */
  pages: number
  /** 최소 쪽수를 채우려고 넣게 될 빈 페이지 수. */
  padded: number
  /** 상한 초과라 이 판형으로는 제작 자체가 불가능. */
  blocked: boolean
  /** 빈 페이지 없이 규격에 딱 맞음. */
  ok: boolean
}

/**
 * 원고가 이 판형으로 제작 가능한지, 어떤 본문 크기가 좋은지 판정한다.
 *
 * 최소 쪽수 미달은 빈 페이지로 채워 제작할 수 있으므로 **막지 않는다**.
 * 막아야 하는 것은 상한 초과뿐이다. 미달을 막으면 짧은 원고를 든 저자가
 * 모든 선택지를 잃고 갇힌다.
 */
export function fitToSpec(
  charCount: number,
  spec: { pageMin: number; pageMax: number },
): { fits: boolean; options: FitOption[]; advice: string } {
  const options: FitOption[] = (Object.keys(TEXT_SIZES) as TextSize[]).map((textSize) => {
    const raw = estimatePages(charCount, textSize)
    const padded = Math.max(0, spec.pageMin - raw)
    return {
      textSize,
      pages: Math.max(raw, spec.pageMin),
      padded,
      blocked: raw > spec.pageMax,
      ok: padded === 0 && raw <= spec.pageMax,
    }
  })

  const fits = options.some((o) => !o.blocked)
  let advice = ""
  if (!fits) {
    advice = `원고가 이 판형의 상한(${spec.pageMax}쪽)을 넘습니다. 본문을 줄이거나 분권을 검토해주세요.`
  } else if (!options.some((o) => o.ok)) {
    const best = options.reduce((a, b) => (a.padded <= b.padded ? a : b))
    advice = `원고가 짧아 최소 ${spec.pageMin}쪽을 채우려면 빈 페이지가 ${best.padded}장 안팎 생깁니다. 본문을 더하거나 더 작은 판형을 고려해보세요.`
  }
  return { fits, options, advice }
}
