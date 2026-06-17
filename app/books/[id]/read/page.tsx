import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { BookOpen, ChevronRight, ShoppingBag } from "lucide-react"
import { Metadata } from "next"
import { BOOKS_DATA } from "@/lib/books-data"
import { getAllBookReaderIds, getBookReaderIndex } from "@/lib/book-reader"
import {
  absoluteUrl,
  bookChapterUrl,
  bookReaderUrl,
  bookUrl,
  SITE_NAME,
  SITE_URL,
  splitAuthors,
  truncateDescription,
} from "@/lib/site-config"

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateStaticParams() {
  return getAllBookReaderIds().map((id) => ({ id }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const book = BOOKS_DATA.find((item) => item.id === id)
  const reader = getBookReaderIndex(id)

  if (!book || !reader) {
    return {
      title: "온라인 공개본을 찾을 수 없습니다",
    }
  }

  const isEnglishReader = book.id === "meet-on-the-road"
  const coverageDescription = reader.coverage === "full" ? "전체 내용을" : "전반부를"
  const description = isEnglishReader
    ? `Read ${book.title}, the complete English online edition, for free. ${reader.chapters.length} chapters are available.`
    : `${book.title} ${coverageDescription} 온라인으로 읽을 수 있는 무료 공개본입니다. ${reader.chapters.length}개 장을 공개합니다.`
  const title = isEnglishReader
    ? `${book.title} Online Edition`
    : `${book.title} 온라인 공개본`

  return {
    title: `${title} | ${SITE_NAME}`,
    description: truncateDescription(description),
    authors: splitAuthors(book.author).map((name) => ({ name })),
    keywords: [
      book.title,
      isEnglishReader ? `${book.title} online edition` : `${book.title} 온라인 읽기`,
      isEnglishReader ? `${book.title} read free` : `${book.title} 무료 공개`,
      book.subtitle,
      book.author,
      book.category,
      isEnglishReader ? "travel memoir" : "여행 에세이",
    ],
    alternates: {
      canonical: bookReaderUrl(book.id),
      languages: {
        [isEnglishReader ? "en" : "ko-KR"]: bookReaderUrl(book.id),
        "x-default": bookReaderUrl(book.id),
      },
    },
    openGraph: {
      title,
      description: truncateDescription(description, 180),
      url: bookReaderUrl(book.id),
      siteName: SITE_NAME,
      images: [
        {
          url: absoluteUrl(book.image),
          width: 800,
          height: 1200,
          alt: `${book.title} ${isEnglishReader ? "cover" : "표지"}`,
        },
      ],
      type: "book",
      locale: isEnglishReader ? "en_US" : "ko_KR",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: truncateDescription(description, 180),
      images: [absoluteUrl(book.image)],
    },
  }
}

export default async function BookReaderIndexPage({ params }: PageProps) {
  const { id } = await params
  const book = BOOKS_DATA.find((item) => item.id === id)
  const reader = getBookReaderIndex(id)

  if (!book || !reader) {
    notFound()
  }

  const totalCharacters = reader.chapters.reduce(
    (sum, chapter) => sum + chapter.characterCount,
    0
  )
  const totalWords = reader.chapters.reduce(
    (sum, chapter) => sum + (chapter.wordCount ?? 0),
    0
  )
  const totalReadTime = reader.chapters.reduce(
    (sum, chapter) => sum + chapter.readTimeMinutes,
    0
  )
  const totalImageCount = reader.chapters.reduce(
    (sum, chapter) => sum + (chapter.imageCount ?? 0),
    0
  )
  const firstChapter = reader.chapters[0]
  const isEnglishReader = book.id === "meet-on-the-road"
  const isFullReader = reader.coverage === "full"
  const labels = isEnglishReader
    ? {
        home: "Home",
        onlineEdition: "Online Edition",
        coverageLabel: isFullReader ? "Free full edition" : "Free excerpt",
        headingSuffix: "Online Edition",
        fallbackDescription: isFullReader
          ? "The complete text is available to read online."
          : "The opening chapters are available to read online.",
        chapters: "chapters",
        minutesPrefix: "about",
        minutesSuffix: " min",
        words: "words",
        photos: "photos",
        readFirst: "Start reading",
        buy: book.amazonLink ? "Buy on Amazon" : "Buy the book",
        chapterCount: "Chapters",
        length: "Length",
        readTime: "Reading time",
        photoCount: "Photos",
        cover: "cover",
      }
    : {
        home: "홈",
        onlineEdition: "온라인 공개본",
        coverageLabel: isFullReader ? "무료 전체 공개본" : "무료 공개본",
        headingSuffix: "온라인 공개본",
        fallbackDescription: `${book.description} ${isFullReader ? "전체 내용을" : "전반부를"} 온라인으로 읽을 수 있습니다.`,
        chapters: "개 장",
        minutesPrefix: "약",
        minutesSuffix: "분",
        words: "자 공개",
        photos: "사진",
        readFirst: "첫 장부터 읽기",
        buy: "종이책 구매하기",
        chapterCount: "공개 장",
        length: "분량",
        readTime: "예상 독서 시간",
        photoCount: "사진",
        cover: "표지",
      }
  const readerSummary = [
    isEnglishReader
      ? `${reader.chapters.length} ${labels.chapters}`
      : `${reader.chapters.length}${labels.chapters}`,
    `${labels.minutesPrefix} ${totalReadTime}${labels.minutesSuffix}`,
    isEnglishReader
      ? `${totalWords.toLocaleString("en-US")} ${labels.words}`
      : `${totalCharacters.toLocaleString("ko-KR")}${labels.words}`,
    totalImageCount > 0
      ? isEnglishReader
        ? `${totalImageCount} ${labels.photos}`
        : `${labels.photos} ${totalImageCount}장`
      : null,
  ]
    .filter(Boolean)
    .join(" · ")
  const purchaseHref = book.naverLink || book.amazonLink

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${bookReaderUrl(book.id)}#reader`,
    "url": bookReaderUrl(book.id),
    "name": `${book.title} ${labels.headingSuffix}`,
    "description": reader.description,
    "inLanguage": isEnglishReader ? "en" : "ko-KR",
    "isPartOf": {
      "@id": `${SITE_URL}/#website`,
    },
    "mainEntity": {
      "@type": "Book",
      "@id": `${bookUrl(book.id)}#book`,
      "name": book.title,
      "author": splitAuthors(book.author).map((name) => ({
        "@type": "Person",
        "name": name,
      })),
      "hasPart": reader.chapters.map((chapter) => ({
        "@type": "Chapter",
        "position": chapter.order,
        "name": chapter.title,
        "url": bookChapterUrl(book.id, chapter.slug),
      })),
    },
  }

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": labels.home,
        "item": SITE_URL,
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": book.title,
        "item": bookUrl(book.id),
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": labels.onlineEdition,
        "item": bookReaderUrl(book.id),
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <main
        lang={isEnglishReader ? "en" : "ko"}
        className="native-cursor min-h-screen bg-[#f5efe5] text-[#201813]"
      >
        <nav className="border-b border-[#201813]/15 px-6 py-5">
          <div className="mx-auto flex max-w-6xl items-center gap-3 overflow-hidden text-sm">
            <Link href="/" className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center text-[#9b3f1d] hover:underline">
              {labels.home}
            </Link>
            <span className="shrink-0 text-[#201813]/40">/</span>
            <Link href={`/books/${book.id}`} className="inline-flex min-h-11 min-w-0 items-center truncate text-[#9b3f1d] hover:underline">
              {book.title}
            </Link>
            <span className="shrink-0 text-[#201813]/40">/</span>
            <span className="inline-flex min-h-11 shrink-0 items-center text-[#201813]/70">{labels.onlineEdition}</span>
          </div>
        </nav>

        <section className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 py-10 lg:grid-cols-[320px_1fr] lg:py-16">
          <article className="order-1 lg:order-2">
            <div className="mb-8 max-w-3xl">
              <p className="mb-4 text-sm font-medium text-[#9b3f1d]">
                {labels.coverageLabel}
              </p>
              <h1 className="font-playfair text-4xl font-normal leading-tight md:text-5xl">
                {book.title} {labels.headingSuffix}
              </h1>
              <p className="mt-4 text-sm font-medium text-[#9b3f1d]">
                {readerSummary}
              </p>
              <p className="mt-5 text-lg leading-8 text-[#201813]/75">
                {reader.description || labels.fallbackDescription}
              </p>
            </div>

            <div className="mb-12 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {firstChapter && (
                <Link
                  href={`/books/${book.id}/read/${firstChapter.slug}`}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-[#201813] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[#3a2b22]"
                >
                  <BookOpen className="h-4 w-4" />
                  {labels.readFirst}
                </Link>
              )}

              {purchaseHref && (
                <a
                  href={purchaseHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-[#9b3f1d]/30 px-5 py-3 text-sm font-medium text-[#9b3f1d] transition-colors hover:bg-[#9b3f1d]/8"
                >
                  <ShoppingBag className="h-4 w-4" />
                  {labels.buy}
                </a>
              )}
            </div>

            <ol className="border-y border-[#201813]/15">
              {reader.chapters.map((chapter) => (
                <li key={chapter.slug} className="border-b border-[#201813]/15 last:border-b-0">
                  <Link
                    href={`/books/${book.id}/read/${chapter.slug}`}
                    className="group grid gap-3 py-6 md:grid-cols-[64px_1fr_auto]"
                  >
                    <span className="font-mono text-sm text-[#9b3f1d]">
                      {String(chapter.order).padStart(2, "0")}
                    </span>
                    <span>
                      <span className="block text-xs font-medium text-[#201813]/55">
                        {chapter.part}
                        {chapter.day ? ` · ${chapter.day}` : ""}
                      </span>
                      <span className="mt-1 block text-xl font-medium group-hover:text-[#9b3f1d]">
                        {chapter.title}
                      </span>
                    </span>
                    <span className="flex items-center gap-2 text-sm text-[#201813]/55">
                      {chapter.imageCount
                        ? isEnglishReader
                          ? `${chapter.imageCount} ${labels.photos} · `
                          : `${chapter.imageCount}장 · `
                        : ""}
                      {chapter.readTimeMinutes}{labels.minutesSuffix}
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </article>

          <aside className="order-2 space-y-6 lg:order-1">
            <div className="relative mx-auto aspect-[3/4] max-w-[260px] overflow-hidden rounded-md shadow-xl lg:mx-0">
              <Image
                src={book.image}
                alt={`${book.title} ${labels.cover}`}
                fill
                priority
                className="object-cover"
                sizes="260px"
              />
            </div>

            <div className="space-y-3 text-sm leading-7 text-[#201813]/70">
              <p>{labels.chapterCount}: {reader.chapters.length}{isEnglishReader ? "" : "개"}</p>
              <p>
                {labels.length}: {labels.minutesPrefix}{" "}
                {isEnglishReader
                  ? `${totalWords.toLocaleString("en-US")} ${labels.words}`
                  : `${totalCharacters.toLocaleString("ko-KR")}자`}
              </p>
              <p>{labels.readTime}: {labels.minutesPrefix} {totalReadTime}{labels.minutesSuffix}</p>
              {totalImageCount > 0 && (
                <p>
                  {labels.photoCount}: {totalImageCount}{isEnglishReader ? "" : "장"}
                </p>
              )}
            </div>
          </aside>
        </section>
      </main>
    </>
  )
}
