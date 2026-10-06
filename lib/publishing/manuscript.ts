// 저자 원고 파일 → 조판 입력(Chapter[]) 변환.
//
// 저자는 .docx로 원고를 준다. .hwp는 파싱 난도가 높아 초기 범위 밖이며,
// "한글에서 .docx로 저장" 안내로 대응한다.
//
// 워드 문단은 이미 한 문단이다. 줄바꿈으로 잘린 평문과 달리 이어 붙이지 않는다.
// <br>은 그 문단의 강제 줄바꿈으로 남긴다.

import mammoth from "mammoth"
import {
  chapterize,
  imageAltText,
  parseManuscript,
  type Block,
  type Chapter,
  type Run,
} from "./typeset"

export interface ParsedManuscript {
  chapters: Chapter[]
  charCount: number
  paragraphCount: number
  /** 저자에게 보여줄 안내. 장을 못 찾았거나 지원 밖 요소를 버린 경우. */
  notes: string[]
}

export const SUPPORTED_EXTENSIONS = [".docx", ".md", ".txt"] as const

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
}

type PFrame = { k: "p" | "q"; lines: Run[][]; cur: Run[] }
type LFrame = { k: "list"; ordered: boolean; start?: number; items: Run[][][]; lines: Run[][]; cur: Run[] }
type HFrame = { k: "h"; level: number; cur: Run[] }
type TFrame = { k: "table"; rows: Run[][][]; row: Run[][] | null; cell: Run[] | null }
type Frame = PFrame | LFrame | HFrame | TFrame

const VOID = new Set(["br", "img", "hr", "wbr"])

/**
 * 스타일 표시 이름에서 제목 단계를 읽는다.
 * 한글 워드의 "제목 1", "개요 1"과 영문 Heading, Title을 같은 규칙으로 본다.
 * 번호가 붙은 이름(제목 1)이 맨 제목(제목)보다 먼저다.
 */
export function headingLevelFromStyle(name: string): number | null {
  const n = name.replace(/\s+/g, " ").trim()
  const numbered = /^(?:heading|제목|개요|outline)\s*([1-6])$/i.exec(n)
  if (numbered) return Number(numbered[1])
  if (/^(?:title|subtitle|제목|문서\s*제목)$/i.test(n)) return 1
  return null
}

function attr(raw: string, name: string): string {
  const m = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(raw)
  return decodeEntities(m?.[1] ?? m?.[2] ?? "")
}

/**
 * mammoth HTML을 블록으로 읽는다.
 * 정규식으로 h/p만 집으면 목록은 통째로 사라지고, 표는 칸 글자만 남긴 채
 * 빠졌다고 안내하게 된다.
 */
function htmlToBlocks(html: string): { blocks: Block[]; images: number } {
  const blocks: Block[] = []
  const stack: Frame[] = []
  let bold = 0
  let italic = 0
  let images = 0

  const top = () => stack[stack.length - 1]

  const hasInk = (runs: Run[] | undefined) => !!runs?.some((r) => r.text.trim())

  const append = (text: string) => {
    if (!text) return
    let frame = top()
    if (!frame) {
      frame = { k: "p", lines: [], cur: [] }
      stack.push(frame)
    }
    const run: Run = { text }
    if (bold > 0) run.bold = true
    if (italic > 0) run.italic = true
    const dest: Run[] | null =
      frame.k === "h" || frame.k === "p" || frame.k === "q" || frame.k === "list"
        ? frame.cur
        : frame.k === "table"
          ? (frame.cell ??= [])
          : null
    if (!dest) return
    const prev = dest[dest.length - 1]
    if (prev && !!prev.bold === !!run.bold && !!prev.italic === !!run.italic) prev.text += text
    else dest.push(run)
  }

  const takeText = (raw: string) => {
    const decoded = decodeEntities(raw).replace(/\s+/g, " ")
    if (!decoded) return
    const frame = top()
    const cur =
      frame && frame.k !== "table" ? frame.cur : frame?.k === "table" ? (frame.cell ?? []) : undefined
    if (!decoded.trim()) {
      if (hasInk(cur)) append(" ")
      return
    }
    append(hasInk(cur) ? decoded : decoded.trimStart())
  }

  const breakLine = () => {
    const frame = top()
    if (!frame) return
    if (frame.k === "table") {
      if (frame.cell?.length) frame.cell.push({ text: " " })
      return
    }
    if (frame.k === "h") {
      if (hasInk(frame.cur)) append(" ")
      return
    }
    if (frame.cur.length || frame.lines.length) {
      frame.lines.push(frame.cur)
      frame.cur = []
    }
  }

  const takeItem = (frame: LFrame) => {
    if (frame.cur.length) frame.lines.push(frame.cur)
    frame.cur = []
    const lines = frame.lines.filter((line) => hasInk(line))
    frame.lines = []
    if (lines.length) frame.items.push(lines)
  }

  const itemRuns = (item: Run[][]): Run[] => {
    const runs: Run[] = []
    for (const line of item) {
      if (!hasInk(line)) continue
      if (runs.length) runs.push({ text: " " })
      runs.push(...line)
    }
    return runs
  }

  const emitList = (frame: LFrame) => {
    takeItem(frame)
    if (!frame.items.length) return
    let owner: TFrame | null = null
    for (let i = stack.length - 1; i >= 0; i--) {
      const ancestor = stack[i]
      if (ancestor.k === "table") {
        owner = ancestor
        break
      }
    }
    if (owner) {
      // 칸 안의 목록을 표보다 먼저 밀면 칸 밖 글이 된다. 그 칸 글에 붙인다.
      if (!owner.cell) owner.cell = []
      for (const item of frame.items) {
        const runs = itemRuns(item)
        if (!runs.length) continue
        if (hasInk(owner.cell)) owner.cell.push({ text: " " })
        owner.cell.push(...runs)
      }
      frame.items = []
      return
    }
    blocks.push({
      kind: "list",
      ordered: frame.ordered,
      ...(frame.start !== undefined ? { start: frame.start } : {}),
      items: frame.items,
    })
    frame.items = []
  }

  const closeParagraph = () => {
    const frame = top()
    if (!frame || frame.k !== "p") return
    if (frame.cur.length) frame.lines.push(frame.cur)
    const lines = frame.lines.filter((line) => hasInk(line))
    if (lines.length) blocks.push({ kind: "p", lines })
    stack.pop()
  }

  const TOKEN = /<!--[\s\S]*?-->|<\/([a-zA-Z0-9]+)>|<([a-zA-Z0-9]+)([^>]*)>|([^<]+)/g
  for (const m of html.matchAll(TOKEN)) {
    if (m[0].startsWith("<!--")) continue
    if (m[1]) {
      const name = m[1].toLowerCase()
      if (name === "strong" || name === "b") bold = Math.max(0, bold - 1)
      else if (name === "em" || name === "i") italic = Math.max(0, italic - 1)
      else if (name === "p") {
        const frame = top()
        if (frame?.k === "p") closeParagraph()
      } else if (/^h[1-6]$/.test(name)) {
        const frame = top()
        if (frame?.k === "h") {
          const runs = frame.cur.filter((r) => r.text)
          if (hasInk(runs)) blocks.push({ kind: "h", level: frame.level, runs })
          stack.pop()
        }
      } else if (name === "li") {
        const frame = top()
        if (frame?.k === "list") takeItem(frame)
      } else if (name === "ul" || name === "ol") {
        const frame = top()
        if (frame?.k === "list") {
          emitList(frame)
          stack.pop()
        }
      } else if (name === "blockquote") {
        const frame = top()
        if (frame?.k === "q") {
          if (frame.cur.length) frame.lines.push(frame.cur)
          const lines = frame.lines.filter((line) => hasInk(line))
          if (lines.length) blocks.push({ kind: "quote", lines })
          stack.pop()
        }
      } else if (name === "td" || name === "th") {
        const frame = top()
        if (frame?.k === "table" && frame.row) {
          frame.row.push(frame.cell ?? [])
          frame.cell = null
        }
      } else if (name === "tr") {
        const frame = top()
        if (frame?.k === "table" && frame.row) {
          frame.rows.push(frame.row)
          frame.row = null
        }
      } else if (name === "table") {
        const frame = top()
        if (frame?.k === "table") {
          if (frame.row) frame.rows.push(frame.row)
          if (frame.rows.some((row) => row.some((cell) => hasInk(cell)))) {
            blocks.push({ kind: "table", rows: frame.rows })
          }
          stack.pop()
        }
      }
      continue
    }

    if (m[2]) {
      const name = m[2].toLowerCase()
      const attrs = m[3] ?? ""
      const self = attrs.endsWith("/") || VOID.has(name)
      if (name === "br" || (name === "hr" && self)) {
        breakLine()
        continue
      }
      if (name === "img") {
        images += 1
        const alt = imageAltText(attr(attrs, "alt"))
        if (alt) {
          const frame = top()
          if (frame && frame.k !== "table") append(alt)
          else blocks.push({ kind: "p", lines: [[{ text: alt }]] })
        }
        continue
      }
      if (self) continue
      if (name === "strong" || name === "b") {
        bold += 1
        continue
      }
      if (name === "em" || name === "i") {
        italic += 1
        continue
      }
      if (name === "p") {
        const frame = top()
        if (frame?.k === "table") {
          if (hasInk(frame.cell ?? undefined)) frame.cell!.push({ text: " " })
          continue
        }
        if (frame?.k === "list" || frame?.k === "q") {
          if (frame.cur.length) {
            frame.lines.push(frame.cur)
            frame.cur = []
          }
          continue
        }
        stack.push({ k: "p", lines: [], cur: [] })
        continue
      }
      if (/^h[1-6]$/.test(name)) {
        stack.push({ k: "h", level: Number(name[1]), cur: [] })
        continue
      }
      if (name === "ul" || name === "ol") {
        const frame = top()
        // 중첩 목록은 지금까지의 항목 뒤에 이어지는 목록 블록이 된다.
        if (frame?.k === "list") emitList(frame)
        const startRaw = name === "ol" ? attr(attrs, "start").trim() : ""
        const startNum = startRaw ? Number(startRaw) : NaN
        stack.push({
          k: "list",
          ordered: name === "ol",
          ...(Number.isFinite(startNum) ? { start: Math.trunc(startNum) } : {}),
          items: [],
          lines: [],
          cur: [],
        })
        continue
      }
      if (name === "li") {
        const frame = top()
        if (frame?.k === "list") takeItem(frame)
        else stack.push({ k: "list", ordered: false, items: [], lines: [], cur: [] })
        continue
      }
      if (name === "table") {
        stack.push({ k: "table", rows: [], row: null, cell: null })
        continue
      }
      if (name === "tr") {
        const frame = top()
        if (frame?.k === "table") {
          if (frame.row) frame.rows.push(frame.row)
          frame.row = []
          frame.cell = null
        }
        continue
      }
      if (name === "td" || name === "th") {
        const frame = top()
        if (frame?.k === "table") {
          if (!frame.row) frame.row = []
          if (frame.cell) frame.row.push(frame.cell)
          frame.cell = []
        }
        continue
      }
      if (name === "blockquote") {
        stack.push({ k: "q", lines: [], cur: [] })
        continue
      }
      continue
    }

    if (m[4]) takeText(m[4])
  }

  closeParagraph()
  while (stack.length) {
    const frame = stack.pop()
    if (frame?.k === "list") emitList(frame)
    else if (frame?.k === "q") {
      if (frame.cur.length) frame.lines.push(frame.cur)
      const lines = frame.lines.filter((line) => hasInk(line))
      if (lines.length) blocks.push({ kind: "quote", lines })
    } else if (frame?.k === "h" && hasInk(frame.cur)) {
      blocks.push({ kind: "h", level: frame.level, runs: frame.cur })
    } else if (frame?.k === "table") {
      if (frame.cell && frame.row) frame.row.push(frame.cell)
      if (frame.row) frame.rows.push(frame.row)
      if (frame.rows.some((row) => row.some((cell) => hasInk(cell)))) {
        blocks.push({ kind: "table", rows: frame.rows })
      }
    }
  }

  return { blocks: blocks.filter((b) => b.kind !== "list" || b.items.length > 0), images }
}

function summarize(chapters: Chapter[], notes: string[]): ParsedManuscript {
  let charCount = 0
  let paragraphCount = 0
  for (const c of chapters) {
    for (const p of c.paragraphs) {
      charCount += p.length
      paragraphCount += 1
    }
  }
  const all = [...notes]
  if (chapters.length === 1 && !chapters[0].title) {
    all.push("장 구분을 찾지 못해 전체를 한 장으로 조판합니다. 제목 스타일을 쓰면 장이 나뉩니다.")
  }
  return { chapters, charCount, paragraphCount, notes: all }
}

type MammothParagraph = { styleName?: string | null; styleId?: string | null }

export async function parseDocx(buffer: Buffer): Promise<ParsedManuscript> {
  const transforms = (mammoth as unknown as {
    transforms: { paragraph: (fn: (p: MammothParagraph) => MammothParagraph) => (doc: unknown) => unknown }
  }).transforms
  const styleMap = [1, 2, 3, 4, 5, 6].flatMap((n) => [
    `p.Heading${n} => h${n}:fresh`,
    `p[style-name='Heading ${n}'] => h${n}:fresh`,
  ])
  const result = await mammoth.convertToHtml(
    { buffer },
    {
      styleMap,
      transformDocument: transforms.paragraph((paragraph) => {
        const level = headingLevelFromStyle(paragraph.styleName || "")
        if (!level) return paragraph
        return { ...paragraph, styleId: `Heading${level}`, styleName: `Heading ${level}` }
      }),
    },
  )
  const { blocks, images } = htmlToBlocks(result.value)
  const notes: string[] = []
  if (images) notes.push(`본문 이미지 ${images}개는 아직 지원하지 않아 제외했습니다.`)
  return summarize(chapterize(blocks), notes)
}

export function parseTextManuscript(raw: string): ParsedManuscript {
  const images = raw.match(/!\[[^\]]*\]\([^)]*\)/g)?.length ?? 0
  const notes: string[] = []
  if (images) notes.push(`본문 이미지 ${images}개는 아직 지원하지 않아 제외했습니다.`)
  return summarize(parseManuscript(raw), notes)
}

/**
 * 디코딩 결과가 원고다운지 본다.
 * 맞는 UTF-16 엔디언은 한글·ASCII가 대부분이고, 뒤집은 엔디언은 거의 그렇지 않다.
 * 치명 디코드가 성공한다는 사실만으로는 엔디언을 고를 수 없다.
 */
function proseScore(text: string): number {
  const chars = [...text]
  if (chars.length === 0) return 0
  let good = 0
  for (const ch of chars) {
    const c = ch.codePointAt(0) ?? 0
    if (
      (c >= 0xac00 && c <= 0xd7a3) ||
      (c >= 0x1100 && c <= 0x11ff) ||
      (c >= 0x3130 && c <= 0x318f) ||
      c === 0x09 ||
      c === 0x0a ||
      c === 0x0d ||
      (c >= 0x20 && c <= 0x7e)
    ) {
      good += 1
    }
  }
  return good / chars.length
}

/**
 * 짝수 길이 버퍼를 UTF-16으로 읽었을 때 원고다우면 그 문자열을 돌려준다.
 * minScore를 넘지 못하면 null. 널이 없는 한글은 더 높은 점수를 요구한다.
 * 대체 문자가 들어간 결과는 fatal 디코드가 거절한다.
 */
function decodeUtf16(buf: Buffer, minScore: number): { text: string; be: boolean } | null {
  let best: { text: string; be: boolean } | null = null
  let bestScore = 0
  for (const encoding of ["utf-16le", "utf-16be"] as const) {
    try {
      const text = new TextDecoder(encoding, { fatal: true }).decode(buf)
      const score = proseScore(text)
      if (score > bestScore) {
        best = { text, be: encoding === "utf-16be" }
        bestScore = score
      }
    } catch {
      // 서로게이트가 깨진 엔디언은 후보에서 뺀다.
    }
  }
  return bestScore >= minScore ? best : null
}

/**
 * EUC-KR 한글 바이트를 UTF-16으로 읽으면 상위 바이트가 리드(0xB0-0xC8),
 * 하위 바이트가 트레일(0xA1-0xFE)에 몰린다. 실제 UTF-16 한글은 하위 바이트가 그렇지 않다.
 * 한글 비율만으로는 둘을 가를 수 없다.
 */
function utf16BytesLookLikeEucKr(buf: Buffer, be: boolean): boolean {
  let hiLead = 0
  let loTrail = 0
  let hangul = 0
  for (let i = 0; i < buf.length; i += 2) {
    const hi = be ? buf[i] : buf[i + 1]
    const lo = be ? buf[i + 1] : buf[i]
    if (hi === 0 && lo < 0x80) continue
    hangul += 1
    if (hi >= 0xb0 && hi <= 0xc8) hiLead += 1
    if (lo >= 0xa1 && lo <= 0xfe) loTrail += 1
  }
  return hangul >= 4 && hiLead / hangul >= 0.9 && loTrail / hangul >= 0.9
}

/**
 * 텍스트 파일의 인코딩을 고른다.
 * BOM, 널이 있는 UTF-16, 적법한 UTF-8 다음에 UTF-16과 EUC-KR을 둘 다 본다.
 * 둘 다 원고로 읽히면 EUC-KR 한글 바이트 모양일 때만 EUC-KR을 고른다.
 *
 * 널이 한쪽에만 있는지로 거르지 않는다. ASCII의 널은 홀수 자리에 모이지만
 * U+AC00(가)처럼 하위 바이트가 0인 한글은 짝수 자리에 널을 둔다.
 */
export function decodeText(buf: Buffer): string {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(buf.subarray(3))
  }
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(buf.subarray(2))
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(buf.subarray(2))
  }
  if (buf.length >= 4 && buf.length % 2 === 0) {
    let nuls = 0
    const n = Math.min(buf.length, 4096)
    for (let i = 0; i < n; i++) if (buf[i] === 0) nuls += 1
    if (nuls >= 2 && nuls / n >= 0.05) {
      const hit = decodeUtf16(buf, 0.6)
      if (hit) return hit.text
    }
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf)
  } catch {
    const utf16 = buf.length >= 8 && buf.length % 2 === 0 ? decodeUtf16(buf, 0.85) : null
    let euc: string | null = null
    try {
      euc = new TextDecoder("euc-kr", { fatal: true }).decode(buf)
    } catch {
      euc = null
    }
    if (utf16 && !(euc && utf16BytesLookLikeEucKr(buf, utf16.be))) return utf16.text
    if (euc) return euc
    throw new Error("이 텍스트 파일의 인코딩을 읽지 못했습니다. UTF-8로 저장해 올려주세요.")
  }
}

/** 확장자로 파서를 고른다. 지원하지 않는 형식은 이유와 함께 던진다. */
export async function parseManuscriptFile(fileName: string, buffer: Buffer): Promise<ParsedManuscript> {
  const ext = fileName.toLowerCase().slice(fileName.lastIndexOf("."))
  if (ext === ".docx") return parseDocx(buffer)
  if (ext === ".md" || ext === ".txt") return parseTextManuscript(decodeText(buffer))
  if (ext === ".hwp" || ext === ".hwpx") {
    throw new Error("한글(.hwp) 파일은 아직 지원하지 않습니다. 한글에서 '다른 이름으로 저장 → .docx'로 저장해 올려주세요.")
  }
  if (ext === ".doc") {
    throw new Error("구버전 워드(.doc)는 지원하지 않습니다. .docx로 저장해 올려주세요.")
  }
  if (ext === ".pdf") {
    throw new Error("PDF는 원고 파일로 받지 않습니다. 원본 문서(.docx)를 올려주세요.")
  }
  throw new Error(`지원하지 않는 형식입니다. ${SUPPORTED_EXTENSIONS.join(", ")} 파일을 올려주세요.`)
}
