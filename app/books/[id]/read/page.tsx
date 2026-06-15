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

  const description = `${book.title} 전반부를 온라인으로 읽을 수 있는 무료 공개본입니다. ${reader.chapters.length}개 장을 공개합니다.`

  return {
    title: `${book.title} 온라인 공개본 | ${SITE_NAME}`,
    description: truncateDescription(description),
    keywords: [
      book.title,
      `${book.title} 온라인 읽기`,
      `${book.title} 무료 공개`,
      book.subtitle,
      book.author,
      book.category,
      "남미 여행기",
      "여행 에세이",
    ],
    alternates: {
      canonical: bookReaderUrl(book.id),
    },
    openGraph: {
      title: `${book.title} 온라인 공개본`,
      description: truncateDescription(description, 180),
      url: bookReaderUrl(book.id),
      siteName: SITE_NAME,
      images: [
        {
          url: absoluteUrl(book.image),
          width: 800,
          height: 1200,
          alt: `${book.title} 표지`,
        },
      ],
      type: "book",
      locale: "ko_KR",
    },
    twitter: {
      card: "summary_large_image",
      title: `${book.title} 온라인 공개본`,
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
  const totalReadTime = reader.chapters.reduce(
    (sum, chapter) => sum + chapter.readTimeMinutes,
    0
  )
  const firstChapter = reader.chapters[0]

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${bookReaderUrl(book.id)}#reader`,
    "url": bookReaderUrl(book.id),
    "name": `${book.title} 온라인 공개본`,
    "description": reader.description,
    "inLanguage": "ko-KR",
    "isPartOf": {
      "@id": `${SITE_URL}/#website`,
    },
    "mainEntity": {
      "@type": "Book",
      "@id": `${bookUrl(book.id)}#book`,
      "name": book.title,
      "author": {
        "@type": "Person",
        "name": book.author,
      },
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
        "name": "홈",
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
        "name": "온라인 공개본",
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
      <main className="min-h-screen bg-[#f5efe5] text-[#201813]">
        <nav className="border-b border-[#201813]/15 px-6 py-5">
          <div className="mx-auto flex max-w-6xl items-center gap-3 text-sm">
            <Link href="/" className="text-[#9b3f1d] hover:underline">
              홈
            </Link>
            <span className="text-[#201813]/40">/</span>
            <Link href={`/books/${book.id}`} className="text-[#9b3f1d] hover:underline">
              {book.title}
            </Link>
            <span className="text-[#201813]/40">/</span>
            <span className="text-[#201813]/70">온라인 공개본</span>
          </div>
        </nav>

        <section className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 py-12 lg:grid-cols-[320px_1fr] lg:py-16">
          <aside className="space-y-6">
            <div className="relative mx-auto aspect-[3/4] max-w-[260px] overflow-hidden rounded-md shadow-xl lg:mx-0">
              <Image
                src={book.image}
                alt={`${book.title} 표지`}
                fill
                priority
                className="object-cover"
                sizes="260px"
              />
            </div>

            <div className="space-y-3 text-sm leading-7 text-[#201813]/70">
              <p>공개 장: {reader.chapters.length}개</p>
              <p>분량: 약 {totalCharacters.toLocaleString("ko-KR")}자</p>
              <p>예상 독서 시간: 약 {totalReadTime}분</p>
            </div>

            {book.naverLink && (
              <a
                href={book.naverLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#b84f22] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#9b3f1d]"
              >
                <ShoppingBag className="h-4 w-4" />
                책 구매하기
              </a>
            )}
          </aside>

          <article>
            <div className="mb-10 max-w-3xl">
              <p className="mb-4 text-sm font-medium tracking-[0.18em] text-[#9b3f1d]">
                ONLINE READER
              </p>
              <h1 className="font-playfair text-4xl font-normal leading-tight md:text-5xl">
                {book.title} 온라인 공개본
              </h1>
              <p className="mt-5 text-lg leading-8 text-[#201813]/75">
                {book.description}
              </p>
            </div>

            {firstChapter && (
              <Link
                href={`/books/${book.id}/read/${firstChapter.slug}`}
                className="mb-12 inline-flex items-center gap-2 rounded-md bg-[#201813] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[#3a2b22]"
              >
                <BookOpen className="h-4 w-4" />
                첫 장부터 읽기
              </Link>
            )}

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
                      {chapter.readTimeMinutes}분
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </article>
        </section>
      </main>
    </>
  )
}
