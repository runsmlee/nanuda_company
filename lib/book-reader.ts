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
  imageCount?: number
}

export interface BookReaderImage {
  src: string
  alt: string
  width: number
  height: number
}

export interface BookReaderMediaGroup {
  afterBlock: number
  caption?: string
  images: BookReaderImage[]
}

export interface BookReaderIndex {
  bookId: string
  title: string
  description: string
  source: string
  coverage?: "partial" | "full"
  chapters: BookReaderChapterMeta[]
}

export interface BookReaderChapter extends BookReaderChapterMeta {
  source: string
  blocks: string[][]
  media?: BookReaderMediaGroup[]
}

export interface BookReaderDisplayBlock {
  text: string
  lines: string[]
  preserveLines: boolean
  sourceBlockIndexes: number[]
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

  if (/^(은|는|이|가|을|를|의|에|로|와|과|도|만|며|고|지|기|라|나|게)(\s|[,.!?])/u.test(trimmedRight)) {
    return true
  }

  if (
    (trimmedLeft.endsWith("어") && /^제(\s|[가-힣])/u.test(trimmedRight)) ||
    (trimmedLeft.endsWith("통") && /^해(\s|[가-힣])/u.test(trimmedRight)) ||
    (trimmedLeft.endsWith("로") && /^자가(\s|[가-힣])/u.test(trimmedRight))
  ) {
    return true
  }

  return /^(어를|려고|리고|지만|른다|나고|났다|널|무진|운|람|던|쳐|친|깐|땅히|하게|적인|동안|럼에|퀴|추어|이게|이겠|쳤|으며|으려|으로|부터|까지|처럼|보다|마저|조차|라도|에게|에서|한테|회와|상에서|건의|둑맞은|성된|본을|었다|어진|아진|지는|가는|보였다)/u.test(rightHead)
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

function shouldPreserveLineRhythm(lines: string[]) {
  const meaningfulLines = lines.map((line) => line.trim()).filter(Boolean)
  if (meaningfulLines.length < 3) return false

  const totalLength = meaningfulLines.reduce((sum, line) => sum + line.length, 0)
  const averageLength = totalLength / meaningfulLines.length
  const shortLineRatio =
    meaningfulLines.filter((line) => line.length <= 28).length / meaningfulLines.length
  const hasVeryLongLine = meaningfulLines.some((line) => line.length > 42)

  return !hasVeryLongLine && (averageLength <= 27 || shortLineRatio >= 0.72)
}

function toDisplayBlock(lines: string[], sourceBlockIndex: number): BookReaderDisplayBlock | null {
  const cleanedLines = lines.map((line) => line.trim()).filter(Boolean)
  if (cleanedLines.length === 0) return null

  const preserveLines = shouldPreserveLineRhythm(cleanedLines)
  const text = preserveLines
    ? cleanedLines.join("\n")
    : normalizeReaderBlock(cleanedLines)

  if (!text) return null

  return {
    text,
    lines: cleanedLines,
    preserveLines,
    sourceBlockIndexes: [sourceBlockIndex],
  }
}

export function getReaderDisplayBlocks(chapter: Pick<BookReaderChapter, "blocks">) {
  return chapter.blocks.reduce<BookReaderDisplayBlock[]>((blocks, block, blockIndex) => {
    const displayBlock = toDisplayBlock(block, blockIndex)
    if (!displayBlock) return blocks

    const previous = blocks[blocks.length - 1]
    if (
      previous &&
      !previous.preserveLines &&
      !displayBlock.preserveLines &&
      shouldJoinPdfLineBreak(previous.text, displayBlock.text)
    ) {
      previous.text = `${previous.text}${displayBlock.text}`
      previous.lines = [...previous.lines, ...displayBlock.lines]
      previous.sourceBlockIndexes = [
        ...previous.sourceBlockIndexes,
        ...displayBlock.sourceBlockIndexes,
      ]
      return blocks
    }

    blocks.push(displayBlock)
    return blocks
  }, [])
}

export function getReaderParagraphs(chapter: Pick<BookReaderChapter, "blocks">) {
  return getReaderDisplayBlocks(chapter).map((block) => block.text)
}

export function getReaderPlainText(chapter: Pick<BookReaderChapter, "blocks">) {
  return getReaderParagraphs(chapter)
    .join("\n\n")
    .replace(/\s+/g, " ")
    .trim()
}
