import fs from "fs"
import path from "path"
import { hasOnlineReader } from "@/lib/book-reader-config"

const readerDirectory = path.join(process.cwd(), "content/book-reader")

export interface BookReaderChapterMeta {
  slug: string
  title: string
  part: string
  day: string
  pageStart: number
  pageEnd: number
  order: number
  characterCount: number
  readTimeMinutes: number
}

export interface BookReaderIndex {
  bookId: string
  title: string
  description: string
  source: string
  chapters: BookReaderChapterMeta[]
}

export interface BookReaderChapter extends BookReaderChapterMeta {
  source: string
  blocks: string[][]
}

function readJsonFile<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) return null
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T
  } catch (error) {
    console.error(`Error reading book reader file ${filePath}:`, error)
    return null
  }
}

export function getAllBookReaderIds() {
  try {
    if (!fs.existsSync(readerDirectory)) return []
    return fs
      .readdirSync(readerDirectory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && hasOnlineReader(entry.name))
      .map((entry) => entry.name)
  } catch (error) {
    console.error("Error reading book reader directory:", error)
    return []
  }
}

export function getBookReaderIndex(bookId: string): BookReaderIndex | null {
  if (!hasOnlineReader(bookId)) return null

  return readJsonFile<BookReaderIndex>(
    path.join(readerDirectory, bookId, "index.json")
  )
}

export function getBookReaderChapter(bookId: string, chapterSlug: string): BookReaderChapter | null {
  if (!hasOnlineReader(bookId)) return null

  return readJsonFile<BookReaderChapter>(
    path.join(readerDirectory, bookId, `${chapterSlug}.json`)
  )
}

export function getAllBookReaderChapterParams() {
  return getAllBookReaderIds().flatMap((bookId) => {
    const index = getBookReaderIndex(bookId)
    if (!index) return []

    return index.chapters.map((chapter) => ({
      id: bookId,
      chapter: chapter.slug,
    }))
  })
}

export function getAdjacentReaderChapters(bookId: string, chapterSlug: string) {
  const index = getBookReaderIndex(bookId)
  if (!index) {
    return { previous: null, next: null }
  }

  const currentIndex = index.chapters.findIndex((chapter) => chapter.slug === chapterSlug)

  return {
    previous: currentIndex > 0 ? index.chapters[currentIndex - 1] : null,
    next:
      currentIndex >= 0 && currentIndex < index.chapters.length - 1
        ? index.chapters[currentIndex + 1]
        : null,
  }
}

function shouldJoinPdfLineBreak(left: string, right: string) {
  const trimmedLeft = left.trimEnd()
  const trimmedRight = right.trimStart()

  if (!trimmedLeft || !trimmedRight) return false

  const leftTail = trimmedLeft.slice(-1)
  const rightHead = trimmedRight.slice(0, 6)
  const isKoreanTail = /[가-힣]$/.test(leftTail)
  const startsWithKorean = /^[가-힣]/.test(trimmedRight)

  if (!isKoreanTail || !startsWithKorean) return false

  if (/^(은|는|이|가|을|를|의|에|로|와|과|도|만|며|고|지|기|라|나)(\s|[,.!?])/u.test(trimmedRight)) {
    return true
  }

  return /^(어를|려고|리고|지만|른다|널|적인|동안|럼에|퀴|추어|이게|이겠|쳤|으며|으려|으로|부터|까지|처럼|보다|마저|조차|라도|에게|에서|한테|회와|상에서)/u.test(rightHead)
}

export function normalizeReaderBlock(lines: string[]) {
  return lines.reduce((paragraph, line) => {
    const current = line.trim()
    if (!current) return paragraph
    if (!paragraph) return current

    return shouldJoinPdfLineBreak(paragraph, current)
      ? `${paragraph}${current}`
      : `${paragraph} ${current}`
  }, "")
}

export function getReaderParagraphs(chapter: Pick<BookReaderChapter, "blocks">) {
  return chapter.blocks.map((block) => normalizeReaderBlock(block)).filter(Boolean)
}

export function getReaderPlainText(chapter: Pick<BookReaderChapter, "blocks">) {
  return getReaderParagraphs(chapter)
    .join("\n\n")
    .replace(/\s+/g, " ")
    .trim()
}
