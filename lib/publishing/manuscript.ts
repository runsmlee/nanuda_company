// 저자 원고 파일 → 조판 입력(Chapter[]) 변환.
//
// 저자는 .docx로 원고를 준다. .hwp는 파싱 난도가 높아 초기 범위 밖이며,
// "한글에서 .docx로 저장" 안내로 대응한다.

import mammoth from "mammoth"
import { joinWrappedLines, parseManuscript, type Chapter } from "./typeset"

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

/**
 * mammoth가 내는 HTML은 블록 태그가 h1~h6과 p로 한정되고 인라인도 몇 개뿐이라,
 * 블록 단위로 잘라 텍스트만 뽑는다.
 */
function htmlToChapters(html: string): { chapters: Chapter[]; notes: string[] } {
  const notes: string[] = []
  const chapters: Chapter[] = []
  let current: Chapter | null = null
  let droppedTables = 0
  let droppedImages = 0

  if (/<table/i.test(html)) droppedTables += (html.match(/<table/gi) || []).length
  if (/<img/i.test(html)) droppedImages += (html.match(/<img/gi) || []).length

  const blockRe = /<(h[1-6]|p)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi
  for (const m of html.matchAll(blockRe)) {
    const tag = m[1].toLowerCase()
    // 줄바꿈(Shift+Enter)은 개행으로 바꾼 뒤 한글 규칙으로 다시 합친다.
    const lines = m[2]
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .split("\n")
      .map((l) => decodeEntities(l).replace(/\s+/g, " ").trim())
    const text = joinWrappedLines(lines).trim()
    if (!text) continue

    if (tag.startsWith("h")) {
      if (current) chapters.push(current)
      current = { title: text, paragraphs: [] }
    } else {
      if (!current) current = { title: "", paragraphs: [] }
      current.paragraphs.push(text)
    }
  }
  if (current) chapters.push(current)

  if (droppedTables) notes.push(`표 ${droppedTables}개는 아직 지원하지 않아 제외했습니다.`)
  if (droppedImages) notes.push(`본문 이미지 ${droppedImages}개는 아직 지원하지 않아 제외했습니다.`)
  return { chapters, notes }
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

export async function parseDocx(buffer: Buffer): Promise<ParsedManuscript> {
  const result = await mammoth.convertToHtml({ buffer })
  const { chapters, notes } = htmlToChapters(result.value)
  return summarize(chapters, notes)
}

export function parseTextManuscript(raw: string): ParsedManuscript {
  return summarize(parseManuscript(raw), [])
}

/** 확장자로 파서를 고른다. 지원하지 않는 형식은 이유와 함께 던진다. */
export async function parseManuscriptFile(
  fileName: string,
  buffer: Buffer,
): Promise<ParsedManuscript> {
  const ext = fileName.toLowerCase().slice(fileName.lastIndexOf("."))
  if (ext === ".docx") return parseDocx(buffer)
  if (ext === ".md" || ext === ".txt") return parseTextManuscript(buffer.toString("utf8"))
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
