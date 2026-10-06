// 원고 → 인쇄용 내지 PDF 조판.
//
// 저자는 인쇄용 PDF를 만들 수 없다. 그 간극을 메우는 것이 이 서비스의 핵심이다.
// 여기서 만든 PDF가 SweetBook의 동기 검증(크기 mm, 페이지 수)을 그대로 통과해야 한다.
//
// 제약: 페이지 수는 판형의 pageMin~pageMax 범위 안에서 pageIncrement의 배수여야 한다.
// (A5 소프트커버 = 50~200p, 2p 단위) 조판 결과가 딱 떨어지지 않으므로 빈 페이지로 맞춘다.
//
// 원고는 문단 문자열이 아니라 블록이다. 제목·목록·표·인용·강제 줄바꿈을 평문으로
// 뭉개면 인쇄본에서 구조가 사라진다. 블록이 없는 옛 호출은 문단 문자열로 본문을 만든다.

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

/** 표제·판권. 본문 쪽수 추정에 더한다. */
export const FRONT_MATTER_PAGES = 2

const PUBLISHER = "생각을나누다"

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
  /** 장을 항상 새 페이지에서 시작할지. 켜면 홀수(오른쪽) 면에서 연다. */
  chapterStartsNewPage: boolean
  title: string
  authorName: string
  /** 판권면에 찍을 출판사. 없으면 생각을나누다. */
  publisher?: string
  /**
   * 미리보기 워터마크를 넣을지.
   *
   * 미리보기는 pdf.js로 브라우저에서 그리므로 인쇄용 PDF 바이트가 이미
   * 사용자 쪽에 가 있다. 내려받기 링크를 없애도 개발자도구로 꺼낼 수 있어,
   * 결제 전에는 이 표시로 인쇄에 못 쓰게 만든다.
   */
  watermark?: boolean
}

/** 한 덩어리의 글자. 굵게·기울임은 여기서만 산다. */
export interface Run {
  text: string
  bold?: boolean
  italic?: boolean
}

/**
 * 조판이 그리는 블록.
 * `p.lines`의 추가 줄은 강제 줄바꿈(br, 시, 마크다운 줄 끝 공백 두 칸)이다.
 * 문단 안의 하드랩은 여기 오기 전에 이미 이어 붙인다.
 */
export type Block =
  | { kind: "p"; lines: Run[][] }
  | { kind: "h"; level: number; runs: Run[] }
  | { kind: "list"; ordered: boolean; start?: number; items: Run[][][] }
  | { kind: "table"; rows: Run[][][] }
  | { kind: "quote"; lines: Run[][] }
  | { kind: "rule" }

export interface Chapter {
  title: string
  /** 글자 수·레거시 호출용 평문. 장 제목은 넣지 않는다. */
  paragraphs: string[]
  blocks?: Block[]
  titleRuns?: Run[]
}

export interface TypesetResult {
  pdf: Buffer
  pageCount: number
  /** 판형 배수에 맞추려고 더한 빈 페이지. 장을 홀수 면에서 열려고 넣은 빈 페이지는 여기 넣지 않는다. */
  paddedPages: number
  withinSpec: boolean
  notes: string[]
}

/** 제본되는 안쪽 여백은 바깥보다 넓게 잡는다 (PUR 무선제본은 안쪽이 말려 들어간다). */
const GUTTER_MM = 18
const OUTER_MM = 14
const TOP_MM = 18
const BOTTOM_MM = 20

/** 양쪽 정렬이 이보다 낱말 사이를 벌리면 그 줄은 왼쪽 정렬로 둔다. */
const GAP_CAP_MM = 1.5

const FONT_REGULAR = "assets/fonts/NanumMyeongjo-Regular.ttf"
const FONT_BOLD = "assets/fonts/NanumMyeongjo-Bold.ttf"

const HANGUL = /[ㄱ-ㆎ가-힣一-鿿]/
/** 문장부호로 끝난 줄은 어절이 이어질 수 없으므로 반드시 띄운다. */
const SENTENCE_END = /[.!?。…"'」』〉·,;:)\]]$/

/**
 * 한 음절로 앞 어절에 붙는 조사·어미.
 * 이/가/로는 빼면 "남자가", "사무실로"가 띄어쓰기 오류가 된다.
 */
const BOUND_SYLLABLE = new Set("은는이가을를과와의에도만서고며요죠게지까로")

/**
 * 그 자체로 한 어절이 되는 한 음절. 여기 있으면 앞줄과 띄운다.
 * 할/해는 용언 조각이라 넣지 않으면 "바다"+"해변" 같은 우연한 붙임을 막으려고가 아니라,
 * "사람"+"할 일이"를 띄우기 위해서다. 해/하로 시작하는 다음 단어를 무조건 붙이면
 * "바다"+"해변이"가 붙으므로 그 규칙은 두지 않는다.
 */
const FREE_SYLLABLE = new Set(
  "것수등더덜또잘못안왜뭐내나너그저한두세네때곳분중앞뒤위속밖후전및좀꼭참막다몇채번쪽뿐데바줄김척법듯년월일시할해",
)

const BOLD_STAR = /(?<![*\w])\*\*([^*]+?)\*\*(?![*\w])/g
const BOLD_UNDER = /(?<!\w)__([^_]+?)__(?!\w)/g
const ITALIC_STAR = /(?<![*\w])\*([^*\n]+?)\*(?![*\w])/g

const CLOSE_CHAR = new Set(Array.from(".,!?;:)]}\"'」』〉》”’。、…·"))
/**
 * 줄 끝에 남기면 다음 줄로 넘기는 여는 부호.
 * ASCII 따옴표는 어절 끝에서는 닫는 부호이므로 넣지 않는다.
 */
const DEDICATED_OPEN = new Set(Array.from("([{「『〈《“‘"))
const AMBIGUOUS_QUOTE = new Set(["'", '"'])
const BREAK_AFTER = new Set(["/", "-", "?", "&"])

/**
 * 줄바꿈으로 잘린 두 줄을 붙일지.
 *
 * 기본은 띄운다. 붙이는 경우는 닫힌 부류뿐이다.
 * 앞줄이 문장부호로 끝났거나, 경계가 한글·한자가 아니면 띄운다.
 * 그 다음 셋 중 하나일 때만 붙인다.
 * (a) 다음 줄이 었/았/였으로 시작한다. 이 음절은 단어의 첫소리가 아니다.
 * (b) 다음 첫 어절이 조사·어미 한 음절이다.
 * (c) 다음 첫 어절이 한 음절인데, 그 자체로 어절이 되는 말이 아니다. 단어가 잘린 조각이다.
 * 다음 첫 어절이 두 음절 이상이면 단어 경계로 보고 띄운다.
 */
export function shouldGlueWrapped(prev: string, next: string): boolean {
  if (SENTENCE_END.test(prev)) return false
  const a = prev[prev.length - 1] ?? ""
  const b = next[0] ?? ""
  if (!HANGUL.test(a) || !HANGUL.test(b)) return false
  if (/^(?:었|았|였)/.test(next)) return true
  const token = next.split(/\s+/)[0] ?? ""
  const syllables = [...token]
  if (syllables.length !== 1) return false
  const syl = syllables[0]
  if (BOUND_SYLLABLE.has(syl)) return true
  return !FREE_SYLLABLE.has(syl)
}

/** 문단 안에서 하드랩 줄을 이어 붙인다. docx 문단은 이미 한 덩어리므로 여기에 넣지 않는다. */
export function joinWrappedLines(lines: string[]): string {
  return lines.reduce((acc, raw) => {
    const line = raw.trim()
    if (!line) return acc
    if (!acc) return line
    return acc + (shouldGlueWrapped(acc, line) ? "" : " ") + line
  }, "")
}

function stripNonEmphasis(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
}

/**
 * 마크다운 인라인 문법을 벗긴다.
 *
 * .md 원고를 그대로 조판하면 `**강조**`나 링크 URL이 종이에 인쇄된다.
 * 이미지는 인쇄본에서 의미가 없으니 통째로 버리고, 링크는 글자만 남긴다.
 *
 * 밑줄 기울임(_x_)과 장면 구분선(---)은 건드리지 않는다. 전자는 file_name 같은
 * 낱말을 망가뜨리고, 후자는 저자가 의도한 구분선일 수 있다.
 */
export function stripInlineMarkdown(text: string): string {
  return stripNonEmphasis(text)
    .replace(BOLD_STAR, "$1")
    .replace(BOLD_UNDER, "$1")
    .replace(ITALIC_STAR, "$1")
}

interface Mark {
  start: number
  end: number
  inner: string
  bold: boolean
  italic: boolean
}

function collectMarks(src: string, re: RegExp, bold: boolean, italic: boolean, occupied: Uint8Array, out: Mark[]) {
  const r = new RegExp(re.source, "g")
  let m: RegExpExecArray | null
  while ((m = r.exec(src))) {
    const start = m.index
    const end = start + m[0].length
    let blocked = false
    for (let i = start; i < end; i++) if (occupied[i]) blocked = true
    if (blocked) {
      r.lastIndex = start + 1
      continue
    }
    for (let i = start; i < end; i++) occupied[i] = 1
    out.push({ start, end, inner: m[1] ?? "", bold, italic })
  }
}

/** stripInlineMarkdown과 같은 순서로 강조를 런으로 가른다. 평문을 이으면 strip 결과와 같다. */
export function parseInlines(text: string): Run[] {
  const src = stripNonEmphasis(text)
  const occupied = new Uint8Array(src.length)
  const marks: Mark[] = []
  collectMarks(src, BOLD_STAR, true, false, occupied, marks)
  collectMarks(src, BOLD_UNDER, true, false, occupied, marks)
  collectMarks(src, ITALIC_STAR, false, true, occupied, marks)
  marks.sort((a, b) => a.start - b.start)

  const runs: Run[] = []
  const push = (value: string, bold?: boolean, italic?: boolean) => {
    if (!value) return
    const prev = runs[runs.length - 1]
    if (prev && !!prev.bold === !!bold && !!prev.italic === !!italic) {
      prev.text += value
      return
    }
    const run: Run = { text: value }
    if (bold) run.bold = true
    if (italic) run.italic = true
    runs.push(run)
  }

  let cursor = 0
  for (const mark of marks) {
    push(src.slice(cursor, mark.start))
    push(mark.inner, mark.bold, mark.italic)
    cursor = mark.end
  }
  push(src.slice(cursor))
  return runs
}

/** 이미지 alt가 문장이면 본문으로 남긴다. 경로·파일명은 버린다. */
export function imageAltText(alt: string): string {
  const t = alt.trim()
  if (!t || /[\\/]/.test(t) || /\.[a-z0-9]{2,5}$/i.test(t)) return ""
  return t
}

export function plainRuns(runs: Run[]): string {
  return runs
    .map((r) => r.text)
    .join("")
    .replace(/[ \t]+/g, " ")
    .trim()
}

function plainLines(lines: Run[][]): string {
  return lines
    .map((runs) => plainRuns(runs))
    .filter(Boolean)
    .join("\n")
    .trim()
}

function paragraphsOf(block: Block): string[] {
  switch (block.kind) {
    case "p":
    case "quote": {
      const t = plainLines(block.lines)
      return t ? [t] : []
    }
    case "h": {
      const t = plainRuns(block.runs)
      return t ? [t] : []
    }
    case "list":
      return block.items.map((item) => plainLines(item)).filter(Boolean)
    case "table":
      return block.rows.flatMap((row) => row.map((cell) => plainRuns(cell)).filter(Boolean))
    case "rule":
      return []
  }
}

function makeChapter(title: string, titleRuns: Run[] | undefined, blocks: Block[]): Chapter {
  const cleaned = blocks.filter((b) => b.kind === "rule" || paragraphsOf(b).length > 0)
  const chapter: Chapter = { title, paragraphs: cleaned.flatMap(paragraphsOf) }
  if (cleaned.length) chapter.blocks = cleaned
  if (titleRuns?.some((r) => r.text.trim())) chapter.titleRuns = titleRuns
  return chapter
}

/** 가장 얕은 제목 단계가 장을 연다. 더 깊은 제목은 장 안의 소제목으로 남는다. */
export function chapterize(blocks: Block[]): Chapter[] {
  let min = Infinity
  for (const b of blocks) if (b.kind === "h") min = Math.min(min, b.level)
  if (!Number.isFinite(min)) {
    if (!blocks.length) return []
    const only = makeChapter("", undefined, blocks)
    return only.paragraphs.length || only.blocks?.length ? [only] : []
  }

  const chapters: Chapter[] = []
  let title = ""
  let titleRuns: Run[] | undefined
  let cur: Block[] = []
  const flush = () => {
    if (!title && cur.length === 0) return
    chapters.push(makeChapter(title, titleRuns, cur))
    title = ""
    titleRuns = undefined
    cur = []
  }
  for (const b of blocks) {
    if (b.kind === "h" && b.level === min) {
      flush()
      title = plainRuns(b.runs)
      titleRuns = b.runs
      continue
    }
    cur.push(b)
  }
  flush()
  return chapters.filter((c) => c.title || c.paragraphs.length || c.blocks?.some((b) => b.kind === "rule"))
}

function blocksOf(chapter: Chapter): Block[] {
  if (chapter.blocks?.length) return chapter.blocks
  return chapter.paragraphs
    .filter((p) => p.trim())
    .map((p) => ({ kind: "p" as const, lines: [[{ text: p }]] }))
}

const HEADING_RE = /^(#{1,6})\s+(.*?)\s*$/
const LIST_RE = /^([-*+]|\d+[.)])\s+(.*)$/
const QUOTE_RE = /^>\s?(.*)$/

function isSceneRule(line: string): boolean {
  return /^(?:-{3,}|\*{3,}|_{3,})$/.test(line) || /^(?:\* )+\*$/.test(line)
}

const YAML_KEY = /^[A-Za-z_][\w.-]*\s*:/

/** 프론트매터로 잘라낼 만큼 YAML처럼 보이는 줄인지. 장면 본문은 아니다. */
function isYamlLine(line: string): boolean {
  if (!line.trim()) return true
  if (/^\s/.test(line)) return true
  const t = line.trim()
  if (t.startsWith("#")) return true
  if (t === "-" || /^-\s+/.test(t)) return true
  if (/^[|>][+-]?$/.test(t)) return true
  return YAML_KEY.test(t)
}

/**
 * 맨 앞의 `---` 울타리를 메타데이터로 볼 때만 끝 인덱스를 돌려준다.
 * 키 줄이 없고 본문이면 장면 구분이다. 울타리를 본문으로 남긴다.
 */
function yamlFrontMatterEnd(lines: string[]): number {
  if (lines[0]?.trim() !== "---") return -1
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === "---")
  if (end <= 0) return -1
  const interior = lines.slice(1, end)
  if (!interior.some((l) => YAML_KEY.test(l.trim()))) return -1
  if (!interior.every(isYamlLine)) return -1
  return end
}

function isTableSeparator(line: string): boolean {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line)
}

function splitTableRow(line: string): string[] {
  let t = line.trim()
  if (t.startsWith("|")) t = t.slice(1)
  if (t.endsWith("|")) t = t.slice(0, -1)
  return t.split("|").map((c) => c.trim())
}

function withImageAlt(text: string): string {
  return text.replace(/!\[([^\]]*)\]\([^)]*\)/g, (_, alt: string) => imageAltText(alt))
}

function hardBreak(line: string): { text: string; hard: boolean } {
  if (/[ \t]{2,}$/.test(line)) return { text: line.replace(/[ \t]+$/, "").trim(), hard: true }
  if (/\\[ \t]*$/.test(line)) return { text: line.replace(/\\[ \t]*$/, "").trim(), hard: true }
  return { text: line.trim(), hard: false }
}

function linesFromRaw(raws: { text: string; hard: boolean }[]): Run[][] {
  const out: Run[][] = []
  let buf: string[] = []
  const flush = () => {
    const joined = withImageAlt(joinWrappedLines(buf))
    buf = []
    const runs = parseInlines(joined).filter((r) => r.text)
    if (runs.length) out.push(runs)
  }
  for (const raw of raws) {
    buf.push(raw.text)
    if (raw.hard) flush()
  }
  flush()
  return out
}

function isStructural(line: string, next: string | undefined): boolean {
  const t = line.trim()
  if (!t) return false
  if (HEADING_RE.test(t) || isSceneRule(t) || QUOTE_RE.test(t)) return true
  if (LIST_RE.test(t) && !/^\s/.test(line)) return true
  if (t.includes("|") && next !== undefined && isTableSeparator(next.trim())) return true
  return false
}

/**
 * 원고 텍스트를 장·문단으로 나눈다.
 * 빈 줄이 문단 경계다. 문단 안의 줄바꿈은 어절 규칙으로 잇고,
 * 줄 끝의 공백 두 칸이나 역슬래시는 강제 줄바꿈으로 남긴다.
 * 가장 얕은 ATX 제목이 장을 연다.
 */
export function parseManuscript(raw: string): Chapter[] {
  let lines = raw.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n")
  const yamlEnd = yamlFrontMatterEnd(lines)
  if (yamlEnd > 0) lines = lines.slice(yamlEnd + 1)

  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed) {
      i += 1
      continue
    }

    const heading = HEADING_RE.exec(trimmed)
    if (heading) {
      const runs = parseInlines(withImageAlt(heading[2]))
      if (plainRuns(runs)) blocks.push({ kind: "h", level: heading[1].length, runs })
      i += 1
      continue
    }

    if (isSceneRule(trimmed)) {
      blocks.push({ kind: "rule" })
      i += 1
      continue
    }

    if (trimmed.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1].trim())) {
      const rows = [splitTableRow(trimmed)]
      i += 2
      while (i < lines.length && lines[i].trim() && lines[i].includes("|") && !isTableSeparator(lines[i].trim())) {
        rows.push(splitTableRow(lines[i]))
        i += 1
      }
      blocks.push({
        kind: "table",
        rows: rows.map((row) => row.map((cell) => parseInlines(withImageAlt(cell)))),
      })
      continue
    }

    if (LIST_RE.test(trimmed) && !/^\s/.test(line)) {
      const head = LIST_RE.exec(trimmed)!
      const ordered = /^\d/.test(head[1])
      const start = ordered ? Number.parseInt(head[1], 10) : undefined
      const items: { text: string; hard: boolean }[][] = []
      let cur: { text: string; hard: boolean }[] = []
      const pushItem = () => {
        if (cur.length) items.push(cur)
        cur = []
      }
      while (i < lines.length) {
        const itemLine = lines[i]
        const itemTrim = itemLine.trim()
        if (!itemTrim) break
        const marker = LIST_RE.exec(itemTrim)
        const indented = /^\s+\S/.test(itemLine)
        if (marker && !indented) {
          if (/^\d/.test(marker[1]) !== ordered) break
          if (ordered) {
            const n = Number.parseInt(marker[1], 10)
            const expected = (start ?? 1) + items.length + (cur.length ? 1 : 0)
            if (n !== expected) break
          }
          pushItem()
          cur = [hardBreak(marker[2])]
          i += 1
          continue
        }
        if (indented && cur.length) {
          const nested = LIST_RE.exec(itemTrim)
          cur.push(hardBreak(nested ? nested[2] : itemTrim))
          i += 1
          continue
        }
        break
      }
      pushItem()
      const parsed = items.map((item) => linesFromRaw(item)).filter((item) => plainLines(item))
      if (parsed.length) {
        blocks.push(
          ordered
            ? { kind: "list", ordered: true, start: start ?? 1, items: parsed }
            : { kind: "list", ordered: false, items: parsed },
        )
      }
      continue
    }

    if (QUOTE_RE.test(trimmed)) {
      const raws: { text: string; hard: boolean }[] = []
      while (i < lines.length && QUOTE_RE.test(lines[i].trim())) {
        raws.push(hardBreak(QUOTE_RE.exec(lines[i].trim())![1]))
        i += 1
      }
      const quoteLines = linesFromRaw(raws)
      if (quoteLines.length) blocks.push({ kind: "quote", lines: quoteLines })
      continue
    }

    const raws: { text: string; hard: boolean }[] = []
    while (i < lines.length && lines[i].trim() && !isStructural(lines[i], lines[i + 1])) {
      raws.push(hardBreak(lines[i]))
      i += 1
    }
    const para = linesFromRaw(raws)
    if (para.length) blocks.push({ kind: "p", lines: para })
  }

  return chapterize(blocks)
}

/**
 * 원고 글자 수로 예상 페이지 수를 어림한다. 업로드 직후 판형 적합성을 알려주는 용도.
 * 본문 상수는 앞머리 없이 A5로 조판한 실측(small 110 / normal 132 / large 160)에서 왔다.
 * 표제·판권 2쪽은 그 위에 더한다.
 */
export function estimatePages(charCount: number, textSize: TextSize): number {
  const perPage = { small: 1019, normal: 849, large: 700 }[textSize]
  return Math.max(1, Math.ceil(charCount / perPage) + FRONT_MATTER_PAGES)
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
 * 최소 쪽수 미달은 빈 페이지로 채워 제작할 수 있으므로 막지 않는다.
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

interface PageMeta {
  front: boolean
  chapter: string
  chapterStart: boolean
  blank: boolean
}

interface Atom {
  text: string
  bold: boolean
  italic: boolean
}

interface Word {
  atoms: Atom[]
  width: number
  /** 같은 원래 어절의 뒷조각. 앞에 공백을 넣지 않는다. */
  glued?: boolean
}

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
  const publisher = opts.publisher?.trim() || PUBLISHER
  const gapCap = mmToPt(GAP_CAP_MM)

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

  const widthCache = new Map<string, number>()
  const measure = (font: "body" | "head", fontSize: number, text: string) => {
    if (!text) return 0
    const key = font + "\0" + fontSize + "\0" + text
    const hit = widthCache.get(key)
    if (hit !== undefined) return hit
    doc.font(font).fontSize(fontSize)
    const w = doc.widthOfString(text)
    widthCache.set(key, w)
    return w
  }
  const spaceWidth = (fontSize: number) => measure("body", fontSize, " ")

  let pageIndex = 0
  const pages: PageMeta[] = []
  let box = { x: 0, y: 0, width: 0, bottom: 0 }
  let cursor = 0
  let currentChapter = ""
  let rectoBlanks = 0

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

  const newPage = (meta: Partial<PageMeta>) => {
    doc.addPage({ size: [pageWpt, pageHpt], margin: 0 })
    pageIndex += 1
    pages.push({
      front: meta.front ?? false,
      chapter: meta.chapter ?? currentChapter,
      chapterStart: meta.chapterStart ?? false,
      blank: meta.blank ?? false,
    })
    box = contentBox()
    cursor = box.y
  }

  const markInk = () => {
    const meta = pages[pageIndex - 1]
    if (meta) meta.blank = false
  }

  const wordFrom = (atoms: Atom[], fontSize: number): Word => {
    const merged: Atom[] = []
    for (const atom of atoms) {
      if (!atom.text) continue
      const prev = merged[merged.length - 1]
      if (prev && prev.bold === atom.bold && prev.italic === atom.italic) prev.text += atom.text
      else merged.push({ ...atom })
    }
    const width = merged.reduce((sum, atom) => sum + measure(atom.bold ? "head" : "body", fontSize, atom.text), 0)
    return { atoms: merged, width }
  }

  const wordsOf = (runs: Run[], fontSize: number): Word[] => {
    const words: Word[] = []
    let atoms: Atom[] = []
    const flush = () => {
      if (!atoms.length) return
      const word = wordFrom(atoms, fontSize)
      atoms = []
      if (word.atoms.length && word.width > 0) words.push(word)
    }
    for (const run of runs) {
      for (const part of run.text.split(/(\s+)/)) {
        if (!part) continue
        if (/^\s+$/.test(part)) flush()
        else atoms.push({ text: part, bold: !!run.bold, italic: !!run.italic })
      }
    }
    flush()
    return words
  }

  const splitLong = (word: Word, maxWidth: number, fontSize: number): Word[] => {
    const chars: Atom[] = []
    for (const atom of word.atoms) {
      for (const ch of atom.text) chars.push({ text: ch, bold: atom.bold, italic: atom.italic })
    }
    const out: Word[] = []
    let i = 0
    while (i < chars.length) {
      let j = i
      let w = 0
      let hint = -1
      while (j < chars.length) {
        const cw = measure(chars[j].bold ? "head" : "body", fontSize, chars[j].text)
        if (j > i && w + cw > maxWidth) break
        w += cw
        if (BREAK_AFTER.has(chars[j].text)) hint = j
        j += 1
      }
      let cut = j
      if (j < chars.length && hint >= i && hint + 1 < j) cut = hint + 1
      if (cut <= i) cut = i + 1
      out.push(wordFrom(chars.slice(i, cut), fontSize))
      i = cut
    }
    return out
  }

  const markPieces = (pieces: Word[], glued: boolean | undefined) => {
    for (let i = 0; i < pieces.length; i++) if (i > 0 || glued) pieces[i].glued = true
    return pieces
  }

  const lastChar = (word: Word) => {
    const atom = word.atoms[word.atoms.length - 1]
    return atom?.text[atom.text.length - 1] ?? ""
  }

  const graphemes = (word: Word) => word.atoms.reduce((n, atom) => n + [...atom.text].length, 0)
  const wordText = (word: Word) => word.atoms.map((atom) => atom.text).join("")
  const isPureCloser = (word: Word) => {
    const text = wordText(word)
    if (!text) return false
    for (const ch of text) if (!CLOSE_CHAR.has(ch)) return false
    return true
  }

  // 전용 닫는 부호만 어절 앞에서 뗀다. "'"로 시작하는 인용은 여는 따옴표이므로 통째로 둔다.
  const splitLeadingClosers = (word: Word, fontSize: number): { lead: Word | null; rest: Word | null } => {
    const chars: Atom[] = []
    for (const atom of word.atoms) {
      for (const ch of atom.text) chars.push({ text: ch, bold: atom.bold, italic: atom.italic })
    }
    let n = 0
    while (n < chars.length && CLOSE_CHAR.has(chars[n].text) && !AMBIGUOUS_QUOTE.has(chars[n].text)) n += 1
    if (n === 0 || n === chars.length) return { lead: null, rest: word }
    const lead = wordFrom(chars.slice(0, n), fontSize)
    const rest = wordFrom(chars.slice(n), fontSize)
    if (word.glued) lead.glued = true
    rest.glued = true
    return { lead, rest }
  }

  const wrapWords = (words: Word[], maxWidth: number | ((lineIndex: number) => number), fontSize: number): Word[][] => {
    const lines: Word[][] = []
    let line: Word[] = []
    let width = 0
    const gap = spaceWidth(fontSize)
    const limitAt = (lineIndex: number) => (typeof maxWidth === "number" ? maxWidth : maxWidth(lineIndex))
    const limit = () => limitAt(lines.length)
    const commit = () => {
      if (line.length) lines.push(line)
      line = []
      width = 0
    }
    const place = (part: Word) => {
      const pending = [part]
      while (pending.length) {
        const cur = pending.shift()!
        const peeled = splitLeadingClosers(cur, fontSize)
        if (peeled.lead && peeled.rest) {
          pending.unshift(peeled.lead, peeled.rest)
          continue
        }
        const max = limit()
        // 닫는 부호만으로 된 짧은 토큰은 줄 머리에 두지 않으려고 앞줄에 붙인다. 한 자 너비를 넘기면 그냥 줄바꿈한다.
        const closes = isPureCloser(cur) && cur.width <= fontSize
        if (line.length && width + gap + cur.width > max && !closes) commit()
        if (!line.length && closes && lines.length) {
          lines[lines.length - 1].push(cur)
          continue
        }
        const room = limit()
        if (cur.width > room && graphemes(cur) > 1) {
          if (line.length) commit()
          const pieces = splitLong(cur, limit(), fontSize)
          if (pieces.length > 1) {
            pending.unshift(...markPieces(pieces, cur.glued))
            continue
          }
        }
        const g = line.length && !cur.glued ? gap : 0
        line.push(cur)
        width += g + cur.width
      }
    }
    for (const word of words) place(word)
    commit()
    for (let li = 0; li < lines.length - 1; li++) {
      const ln = lines[li]
      if (!ln.length || !DEDICATED_OPEN.has(lastChar(ln[ln.length - 1]))) continue
      const moved = ln.pop()
      if (!moved || !ln.length) {
        if (moved) ln.push(moved)
        continue
      }
      lines[li + 1].unshift(moved)
    }
    // 금칙이 어절을 옮겨도 본문 폭을 한 자 넘게 넘기면 다시 나눈다. 한 글자는 어쩔 수 없이 둔다.
    const lineWidth = (ln: Word[]) =>
      ln.reduce((sum, word, i) => sum + word.width + (i > 0 && !word.glued ? gap : 0), 0)
    for (let li = 0; li < lines.length; li++) {
      const max = limitAt(li)
      let guard = 0
      while (lineWidth(lines[li]) > max + fontSize && lines[li].length > 1) {
        if (++guard > 10000) break
        const moved = lines[li].pop()!
        if (!lines[li + 1]) lines.push([])
        lines[li + 1].unshift(moved)
      }
      const only = lines[li]
      if (only.length === 1 && only[0].width > max && graphemes(only[0]) > 1) {
        const pieces = markPieces(splitLong(only[0], max, fontSize), only[0].glued)
        if (pieces.length > 1) {
          lines.splice(li, 1, ...pieces.map((piece) => [piece]))
          li -= 1
        }
      }
    }
    return lines.filter((ln) => ln.length)
  }

  const paintAtom = (atom: Atom, x: number, y: number, fontSize: number) => {
    const font = atom.bold ? "head" : "body"
    doc.font(font).fontSize(fontSize).fillColor("#000000")
    // 기울임 전용 글꼴은 없다. pdfkit oblique는 글자 기준점에서 기울여, 페이지 뒤집기와 겹치지 않는다.
    doc.text(atom.text, x, y, atom.italic ? { lineBreak: false, oblique: 14 } : { lineBreak: false })
  }

  const drawWords = (words: Word[], x: number, y: number, maxWidth: number, fontSize: number, justify: boolean) => {
    if (!words.length) return
    markInk()
    const space = spaceWidth(fontSize)
    const opens = (i: number) => i > 0 && !words[i].glued
    let gaps = 0
    for (let i = 1; i < words.length; i++) if (opens(i)) gaps += 1
    const contentW = words.reduce((sum, word) => sum + word.width, 0)
    let extra = 0
    if (justify && gaps > 0) {
      const slack = (maxWidth - contentW - space * gaps) / gaps
      if (slack > 0 && slack <= gapCap) extra = slack
    }
    let cx = x
    for (let i = 0; i < words.length; i++) {
      if (opens(i)) cx += space + extra
      let ax = cx
      for (const atom of words[i].atoms) {
        paintAtom(atom, ax, y, fontSize)
        ax += measure(atom.bold ? "head" : "body", fontSize, atom.text)
      }
      cx += words[i].width
    }
  }

  const ensure = (height: number, chapterStart = false) => {
    if (cursor > box.y + 0.5 && cursor + height > box.bottom) {
      newPage({ front: false, blank: false, chapterStart, chapter: currentChapter })
    }
  }

  const drawHardLines = (
    hardLines: Run[][],
    o: { fontSize: number; justify: boolean; indentFirst: boolean; inset: number; hanging: number; marker?: string },
  ) => {
    const step = o.fontSize + size.lineGap
    hardLines.forEach((runs, hi) => {
      const words = wordsOf(runs, o.fontSize)
      const widthOf = (lineIndex: number) => {
        const indent = o.indentFirst && hi === 0 && lineIndex === 0 ? o.fontSize : 0
        return Math.max(mmToPt(8), box.width - o.inset * 2 - o.hanging - indent)
      }
      const xOf = (lineIndex: number) => {
        const indent = o.indentFirst && hi === 0 && lineIndex === 0 ? o.fontSize : 0
        return box.x + o.inset + o.hanging + indent
      }
      if (!words.length) {
        ensure(step)
        if (hi === 0 && o.marker) {
          doc.font("body").fontSize(o.fontSize).fillColor("#000000")
          doc.text(o.marker, box.x + o.inset, cursor, { lineBreak: false })
          markInk()
        }
        cursor += step
        return
      }
      const lines = wrapWords(words, widthOf, o.fontSize)
      lines.forEach((line, li) => {
        ensure(step)
        if (li === 0 && hi === 0 && o.marker) {
          doc.font("body").fontSize(o.fontSize).fillColor("#000000")
          doc.text(o.marker, box.x + o.inset, cursor, { lineBreak: false })
          markInk()
        }
        const last = hi === hardLines.length - 1 && li === lines.length - 1
        drawWords(line, xOf(li), cursor, widthOf(li), o.fontSize, o.justify && !last)
        cursor += step
      })
    })
  }

  // 앞머리. 쪽수는 나중에 본문부터 찍으므로 여기서는 글자만 둔다.
  newPage({ front: true, chapter: "", chapterStart: false, blank: false })
  drawTitlePage()
  newPage({ front: true, chapter: "", chapterStart: false, blank: false })
  drawCopyright()

  chapters.forEach((chapter, index) => {
    currentChapter = chapter.title
    openChapter(index)
    if (chapter.title.trim()) {
      const runs = chapter.titleRuns?.some((r) => r.text.trim()) ? chapter.titleRuns : [{ text: chapter.title }]
      drawChapterTitle(runs)
    }
    for (const block of blocksOf(chapter)) drawBlock(block)
  })

  let paddedPages = 0
  const needsMore = () =>
    pageIndex < opts.pageMin || (pageIndex - opts.pageMin) % opts.pageIncrement !== 0
  while (needsMore() && pageIndex < opts.pageMax) {
    newPage({ front: false, blank: true, chapter: "", chapterStart: false })
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
  if (rectoBlanks > 0) {
    notes.push(`장을 홀수 페이지에서 시작하려고 빈 페이지 ${rectoBlanks}장을 넣었습니다.`)
  }

  const range = doc.bufferedPageRange()
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i)
    const meta = pages[i] ?? { front: false, chapter: "", chapterStart: false, blank: false }
    const isRight = (i + 1) % 2 === 1
    const left = bleedPt + mmToPt(isRight ? GUTTER_MM : OUTER_MM)
    const right = bleedPt + mmToPt(isRight ? OUTER_MM : GUTTER_MM)
    const x = left
    const w = pageWpt - left - right

    if (!meta.front) {
      doc.font("body").fontSize(8.5).fillColor("#555555")
      doc.text(String(i + 1), x, pageHpt - bleedPt - mmToPt(12), {
        width: w,
        align: isRight ? "right" : "left",
        lineBreak: false,
      })
    }

    if (!meta.front && !meta.chapterStart && !meta.blank) {
      const label = (meta.chapter || opts.title || "").replace(/\s+/g, " ").trim()
      if (label) {
        doc.font("body").fontSize(8).fillColor("#555555")
        doc.text(ellipsize(label, w, 8), x, bleedPt + mmToPt(8), {
          width: w,
          align: isRight ? "right" : "left",
          lineBreak: false,
        })
      }
    }

    if (opts.watermark) drawWatermark(doc, pageWpt, pageHpt)
  }

  doc.end()
  const pdf = await done
  return { pdf, pageCount: totalPages, paddedPages, withinSpec, notes }

  function ellipsize(text: string, width: number, fontSize: number): string {
    if (measure("body", fontSize, text) <= width) return text
    let t = text
    while (t.length > 1 && measure("body", fontSize, t + "…") > width) t = t.slice(0, -1)
    return t + "…"
  }

  function drawFitted(
    value: string,
    font: "head" | "body",
    fontSize: number,
    y: number,
    cap: number,
    lineGap: number,
    note: string,
  ) {
    doc.font(font).fontSize(fontSize).fillColor(font === "head" ? "#000000" : "#222222")
    const layout = { width: box.width, align: "center" as const, lineGap }
    if (doc.heightOfString(value, layout) <= cap) {
      doc.text(value, box.x, y, layout)
    } else {
      doc.text(value, box.x, y, { ...layout, height: cap, ellipsis: true })
      notes.push(note)
    }
    markInk()
  }

  function drawTitlePage() {
    const text = opts.title.trim()
    const titleCap = mmToPt(36)
    let fontSize = 22
    if (text) {
      doc.font("head")
      while (fontSize > 13) {
        doc.fontSize(fontSize)
        if (doc.heightOfString(text, { width: box.width, align: "center", lineGap: 3 }) <= titleCap) break
        fontSize -= 1
      }
      drawFitted(text, "head", fontSize, pageHpt * 0.32, titleCap, 3, "제목이 길어 표제 면에는 일부만 넣었습니다.")
    }
    const ruleY = (text ? doc.y : pageHpt * 0.4) + mmToPt(5)
    const mid = box.x + box.width / 2
    doc
      .moveTo(mid - mmToPt(8), ruleY)
      .lineTo(mid + mmToPt(8), ruleY)
      .lineWidth(0.7)
      .strokeColor("#333333")
      .stroke()
    const author = opts.authorName.trim()
    if (author) {
      drawFitted(author, "body", 11, ruleY + mmToPt(5), mmToPt(28), 0, "지은이 이름이 길어 표제 면에는 일부만 넣었습니다.")
    }
  }

  function drawCopyright() {
    cursor = pageHpt * 0.3
    const write = (text: string, font: "head" | "body", fontSize: number) => {
      const value = text.trim()
      if (!value) return
      doc.font(font).fontSize(fontSize).fillColor("#000000")
      doc.text(value, box.x, cursor, { width: box.width, height: mmToPt(28), ellipsis: true, lineGap: 2 })
      cursor = doc.y + mmToPt(4)
      markInk()
    }
    write(opts.title, "head", size.fontSize + 4)
    write(opts.authorName, "body", size.fontSize)
    write(publisher, "body", size.fontSize)
  }

  function openChapter(index: number) {
    const fresh = (chapterStart: boolean) =>
      newPage({ front: false, blank: false, chapterStart, chapter: currentChapter })
    if (index === 0) {
      fresh(true)
      return
    }
    if (opts.chapterStartsNewPage) {
      fresh(true)
      if (pageIndex % 2 === 0) {
        const meta = pages[pageIndex - 1]
        meta.blank = true
        meta.chapterStart = false
        meta.chapter = ""
        rectoBlanks += 1
        fresh(true)
      }
      return
    }
    cursor += mmToPt(8)
    const need = size.fontSize + 4 + mmToPt(8) + (size.fontSize + size.lineGap) * 2
    if (cursor + need > box.bottom) fresh(true)
  }

  function drawChapterTitle(runs: Run[]) {
    const fontSize = size.fontSize + 4
    const step = fontSize + 3
    // 장 제목은 본문과 같은 글꼴 굵기가 아니다. 예전 조판과 같이 제목 글꼴을 쓴다.
    const words = wordsOf(runs.map((r) => ({ ...r, bold: true })), fontSize)
    const lines = wrapWords(words, box.width, fontSize)
    const need = Math.max(1, lines.length) * step + mmToPt(8) + (size.fontSize + size.lineGap) * 2
    ensure(need, true)
    if (pages[pageIndex - 1] && cursor <= box.y + 0.5) pages[pageIndex - 1].chapterStart = true
    for (const line of lines) {
      ensure(step, true)
      drawWords(line, box.x, cursor, box.width, fontSize, false)
      cursor += step
    }
    cursor += mmToPt(6)
  }

  function drawBlock(block: Block) {
    const step = size.fontSize + size.lineGap
    switch (block.kind) {
      case "p":
        ensure(step)
        drawHardLines(block.lines, {
          fontSize: size.fontSize,
          justify: true,
          indentFirst: true,
          inset: 0,
          hanging: 0,
        })
        return
      case "quote":
        ensure(step)
        drawHardLines(block.lines, {
          fontSize: size.fontSize,
          justify: true,
          indentFirst: false,
          inset: mmToPt(4),
          hanging: 0,
        })
        return
      case "h": {
        const fontSize = size.fontSize + (block.level <= 2 ? 3 : 2)
        const headStep = fontSize + size.lineGap
        ensure(headStep + step * 2)
        const runs = block.runs.map((r) => ({ ...r, bold: true }))
        drawHardLines([runs], { fontSize, justify: false, indentFirst: false, inset: 0, hanging: 0 })
        cursor += mmToPt(2)
        return
      }
      case "rule": {
        ensure(step)
        const label = "· · ·"
        const w = measure("body", size.fontSize, label)
        doc.font("body").fontSize(size.fontSize).fillColor("#555555")
        doc.text(label, box.x + Math.max(0, (box.width - w) / 2), cursor, { lineBreak: false })
        doc.fillColor("#000000")
        markInk()
        cursor += step
        return
      }
      case "list":
        block.items.forEach((item, idx) => {
          const marker = block.ordered ? `${(block.start ?? 1) + idx}.` : "·"
          const hanging = Math.max(mmToPt(6), measure("body", size.fontSize, marker) + mmToPt(1.5))
          ensure(step)
          drawHardLines(item.length ? item : [[{ text: "" }]], {
            fontSize: size.fontSize,
            justify: true,
            indentFirst: false,
            inset: 0,
            hanging,
            marker,
          })
        })
        return
      case "table":
        drawTable(block.rows)
        return
    }
  }

  function drawTable(rows: Run[][][]) {
    if (!rows.length) return
    const fontSize = Math.max(8, size.fontSize - 1)
    const step = fontSize + 2
    const pad = mmToPt(1.2)
    const cols = Math.max(1, ...rows.map((row) => row.length))
    const weights = Array.from({ length: cols }, () => mmToPt(10))
    for (const row of rows) {
      row.forEach((cell, i) => {
        const plain = plainRuns(cell).slice(0, 32)
        weights[i] = Math.max(weights[i], Math.min(measure("body", fontSize, plain) || mmToPt(10), box.width * 0.55))
      })
    }
    const sum = weights.reduce((a, b) => a + b, 0) || 1
    let widths = weights.map((w) => (box.width * w) / sum)
    const minCol = pad * 2 + fontSize
    if (cols * minCol <= box.width + 0.01) {
      for (let guard = 0; guard < cols && widths.some((w) => w < minCol - 0.05); guard++) {
        let deficit = 0
        let wideSum = 0
        for (const w of widths) {
          if (w < minCol) deficit += minCol - w
          else wideSum += w
        }
        if (wideSum <= deficit + 0.01) break
        widths = widths.map((w) => (w < minCol ? minCol : w - (deficit * w) / wideSum))
      }
    }
    const innerOf = (ci: number) => Math.max(0, widths[ci] - pad * 2)
    const rule = (y: number) => {
      doc.save()
      doc.moveTo(box.x, y).lineTo(box.x + box.width, y).lineWidth(0.4).strokeColor("#b5b5b5").stroke()
      doc.restore()
      markInk()
    }
    const paintLine = (line: Word[] | undefined, ci: number, y: number) => {
      if (!line?.length) return
      const x = box.x + widths.slice(0, ci).reduce((a, b) => a + b, 0) + pad
      drawWords(line, x, y, innerOf(ci), fontSize, false)
    }

    rows.forEach((row, ri) => {
      const cells = Array.from({ length: cols }, (_, ci) => {
        const inner = innerOf(ci)
        const words = wordsOf(row[ci] ?? [], fontSize)
        return words.length ? wrapWords(words, inner, fontSize) : []
      })
      const nLines = Math.max(1, ...cells.map((c) => c.length))
      const rowH = nLines * step + pad * 2
      const pageRoom = box.bottom - box.y
      if (rowH <= pageRoom) {
        ensure(rowH)
        if (ri === 0) rule(cursor)
        for (let li = 0; li < nLines; li++) {
          cells.forEach((lines, ci) => paintLine(lines[li], ci, cursor + pad + li * step))
        }
        cursor += rowH
        rule(cursor)
        return
      }
      for (let li = 0; li < nLines; li++) {
        ensure(step + pad)
        if (li === 0) rule(cursor)
        cells.forEach((lines, ci) => paintLine(lines[li], ci, cursor + pad / 2))
        cursor += step
      }
      rule(cursor)
    })
    cursor += size.lineGap
  }

}

/**
 * 결제 전 미리보기 표시. 본문을 읽는 데는 방해가 되지 않을 만큼 옅게,
 * 인쇄해서 쓰기에는 곤란할 만큼 크게 대각선으로 깐다.
 */
function drawWatermark(doc: PDFKit.PDFDocument, pageWpt: number, pageHpt: number) {
  const size = pageWpt * 0.082
  doc.save()
  doc.rotate(-38, { origin: [pageWpt / 2, pageHpt / 2] })
  doc.font("head").fontSize(size).fillColor("#000000").fillOpacity(0.12)
  doc.text("미리보기 · 생각을나누다", 0, pageHpt / 2 - size * 0.7, {
    width: pageWpt,
    align: "center",
    lineBreak: false,
  })
  doc.restore()
  doc.fillOpacity(1).fillColor("#000000")
}
