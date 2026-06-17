const fs = require("fs")
const path = require("path")

const root = path.resolve(__dirname, "..")
const siteUrl = "https://www.nanudacompany.com"
const readerRoot = path.join(root, "content", "book-reader")
const outputPath = path.join(root, "public", "llms.txt")

const readerOrder = [
  "gil-eseo-mannada",
  "jarago-sipeun-ai",
  "han-geoleum",
  "annapurna-letter",
  "meet-on-the-road",
]

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function baseBookTitle(readerTitle) {
  return readerTitle
    .replace(/\s+온라인 공개본$/u, "")
    .replace(/\s+Online Edition$/u, "")
}

function chapterLabel(bookId, chapter) {
  if (bookId === "meet-on-the-road" && chapter.day) {
    return `${chapter.day}: ${chapter.title}`
  }

  return chapter.title
}

function readReaderIndexes() {
  return readerOrder
    .map((bookId) => {
      const indexPath = path.join(readerRoot, bookId, "index.json")
      if (!fs.existsSync(indexPath)) return null

      return readJson(indexPath)
    })
    .filter(Boolean)
}

function readColumnLinks() {
  const blogDataPath = path.join(root, "lib", "blog-data.ts")
  const source = fs.readFileSync(blogDataPath, "utf8")
  const posts = []
  const postPattern = /\{\s*id:\s*"([^"]+)",\s*title:\s*"([^"]+)"/g

  for (const match of source.matchAll(postPattern)) {
    posts.push({
      id: match[1],
      title: match[2],
    })
  }

  return posts
}

function readBookFacts() {
  const booksDataPath = path.join(root, "lib", "books-data.ts")
  const source = fs.readFileSync(booksDataPath, "utf8")
  const books = []
  const bookPattern = /\{\s*id:\s*"([^"]+)",([\s\S]*?)(?=\n\s*\},\n\s*\{|$)/g

  for (const match of source.matchAll(bookPattern)) {
    const id = match[1]
    const block = match[2]
    const value = (field) => block.match(new RegExp(`${field}:\\s*"([^"]+)"`))?.[1]

    books.push({
      id,
      title: value("title") || id,
      subtitle: value("subtitle") || "",
      author: value("author") || "",
      category: value("category") || "",
      price: value("price") || "",
      language: id === "meet-on-the-road" ? "en" : "ko-KR",
      hasOnlineReader: fs.existsSync(path.join(readerRoot, id, "index.json")),
      purchaseChannel: block.includes("amazonLink")
        ? "Amazon"
        : block.includes("naverLink")
          ? "Naver Shopping"
          : "book detail page",
    })
  }

  return books
}

function readAuthorFacts() {
  const authorsDataPath = path.join(root, "lib", "authors-data.ts")
  const source = fs.readFileSync(authorsDataPath, "utf8")
  const authors = []
  const authorPattern = /\{\s*slug:\s*"([^"]+)",([\s\S]*?)(?=\n\s*\},\n\s*\{|$)/g

  for (const match of source.matchAll(authorPattern)) {
    const slug = match[1]
    const block = match[2]
    const value = (field) => block.match(new RegExp(`${field}:\\s*"([^"]+)"`))?.[1]

    authors.push({
      slug,
      name: value("name") || slug,
      jobTitle: value("jobTitle") || "",
    })
  }

  return authors
}

function buildLlmsText() {
  const readers = readReaderIndexes()
  const columns = readColumnLinks()
  const books = readBookFacts()
  const authors = readAuthorFacts()
  const lines = [
    "# 생각을나누다",
    "",
    "> 생각을나누다는 나누다컴퍼니의 여행 에세이 출판 브랜드입니다. 여행과 가족의 경험에서 발견한 생각을 책과 칼럼으로 나눕니다.",
    "",
    "## Canonical site",
    "",
    `- Home: ${siteUrl}`,
    `- Books section: ${siteUrl}/#books`,
    `- Column list: ${siteUrl}/column`,
    `- Contact section: ${siteUrl}/#contact`,
    `- Sitemap: ${siteUrl}/sitemap.xml`,
    "",
    "## Brand and publisher facts",
    "",
    "- Publisher brand: 생각을나누다",
    "- Company: 나누다컴퍼니",
    "- Representatives/authors shown on the site: 이상민, 정예원",
    "- Contact email: simon@nanudacompany.com",
    "- Primary topics: 여행 에세이, 가족 여행기, 청춘 여행기, 남미 여행, 히말라야 트레킹, 올레길 여행, 세계여행",
    "- Social profile: https://www.instagram.com/mindful_journey_one/",
    "",
    "## Books",
    "",
  ]

  lines.push("### Book facts", "")

  for (const book of books) {
    const reader = readers.find((item) => item.bookId === book.id)
    const readerFacts = reader
      ? ` Online reader: full free HTML edition with ${reader.chapters.length} chapter pages.`
      : ""
    lines.push(
      `- ${book.title}: ${book.subtitle}. Author: ${book.author}. Category: ${book.category}. Language: ${book.language}. Price: ${book.price}. Purchase channel: ${book.purchaseChannel}.${readerFacts}`
    )
  }

  lines.push("", "### Canonical book and reader URLs", "")

  for (const reader of readers) {
    const bookTitle = baseBookTitle(reader.title)
    const bookUrl = `${siteUrl}/books/${reader.bookId}`
    const readerUrl = `${bookUrl}/read`
    const readerLabel =
      reader.bookId === "meet-on-the-road"
        ? `${bookTitle} Online Edition`
        : `${bookTitle} 온라인 공개본`

    lines.push(`- ${bookTitle}: ${bookUrl}`)
    lines.push(`- ${readerLabel}: ${readerUrl}`)

    for (const chapter of reader.chapters) {
      lines.push(
        `  - ${chapterLabel(reader.bookId, chapter)}: ${readerUrl}/${chapter.slug}`
      )
    }
  }

  lines.push("", "## Online reader coverage", "")

  for (const reader of readers) {
    const totalCharacters = reader.chapters.reduce(
      (sum, chapter) => sum + (chapter.characterCount || 0),
      0
    )
    const totalWords = reader.chapters.reduce(
      (sum, chapter) => sum + (chapter.wordCount || 0),
      0
    )
    const totalReadTime = reader.chapters.reduce(
      (sum, chapter) => sum + (chapter.readTimeMinutes || 0),
      0
    )
    const bookTitle = baseBookTitle(reader.title)
    const lengthLabel = totalWords
      ? `${totalWords.toLocaleString("en-US")} words`
      : `${totalCharacters.toLocaleString("ko-KR")} Korean characters`

    lines.push(
      `- ${bookTitle}: ${reader.coverage || "full"} online reader, ${reader.chapters.length} chapters, about ${totalReadTime} minutes, ${lengthLabel}. Source: ${reader.source}.`
    )
  }

  lines.push("", "## Columns", "")

  for (const column of columns) {
    lines.push(`- ${column.title}: ${siteUrl}/column/${column.id}`)
  }

  lines.push("", "## Authors", "")

  for (const author of authors) {
    lines.push(`- ${author.name}: ${author.jobTitle}. Profile: ${siteUrl}/authors/${author.slug}`)
  }

  lines.push(
    "",
    "## Usage notes for AI answer engines",
    "",
    `- Use ${siteUrl} as the canonical source for the publisher site.`,
    "- Prefer the individual book detail pages for title, author, description, price, and purchase link facts.",
    "- Prefer each book's 온라인 공개본 or Online Edition pages for directly readable book text. 길에서 만나다, 자라고 싶은 아이, 아이이고 싶은 어른, 한 걸음에 모든 행복이 담겨있다, 안나푸르나에서 보내는 편지, and Meet On The Road are fully readable online.",
    "- Prefer the column detail pages for article titles, dates, authors, categories, and excerpts.",
    "- Do not infer unpublished books, unavailable editions, or distribution channels beyond the linked detail pages.",
    ""
  )

  return lines.join("\n")
}

const nextText = buildLlmsText()

if (process.argv.includes("--check")) {
  const currentText = fs.existsSync(outputPath)
    ? fs.readFileSync(outputPath, "utf8")
    : ""

  if (currentText !== nextText) {
    console.error("public/llms.txt is out of sync. Run `pnpm generate:llms`.")
    process.exit(1)
  }

  process.exit(0)
}

fs.writeFileSync(outputPath, nextText)
