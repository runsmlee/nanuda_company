import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Fragment } from "react"
import { BookOpen, ChevronLeft, ChevronRight, List, ShoppingBag } from "lucide-react"
import { Metadata } from "next"
import { BOOKS_DATA } from "@/lib/books-data"
import {
  type BookReaderMediaGroup,
  getAdjacentReaderChapters,
  getAllBookReaderChapterParams,
  getBookReaderChapter,
  getBookReaderIndex,
  getReaderDisplayBlocks,
  getReaderPlainText,
} from "@/lib/book-reader"
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
  params: Promise<{ id: string; chapter: string }>
}

export async function generateStaticParams() {
  return getAllBookReaderChapterParams()
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id, chapter: chapterSlug } = await params
  const book = BOOKS_DATA.find((item) => item.id === id)
  const chapter = getBookReaderChapter(id, chapterSlug)

  if (!book || !chapter) {
    return {
      title: "본문을 찾을 수 없습니다",
    }
  }

  const isEnglishReader = book.id === "meet-on-the-road"
  const description = truncateDescription(getReaderPlainText(chapter), 155)
  const title = isEnglishReader
    ? `${chapter.title} - ${book.title} Online Edition`
    : `${chapter.title} - ${book.title} 온라인 공개본`

  return {
    title: `${title} | ${SITE_NAME}`,
    description,
    keywords: [
      book.title,
      chapter.title,
      chapter.part,
      isEnglishReader ? `${book.title} online edition` : `${book.title} 온라인 읽기`,
      isEnglishReader ? `${book.title} read free` : `${book.title} 무료 공개본`,
      book.subtitle,
      book.category,
      isEnglishReader ? "travel memoir" : "여행 에세이",
    ],
    alternates: {
      canonical: bookChapterUrl(book.id, chapter.slug),
    },
    openGraph: {
      title: `${chapter.title} - ${book.title}`,
      description: truncateDescription(description, 180),
      url: bookChapterUrl(book.id, chapter.slug),
      siteName: SITE_NAME,
      images: [absoluteUrl(book.image)],
      type: "article",
      locale: isEnglishReader ? "en_US" : "ko_KR",
    },
    twitter: {
      card: "summary_large_image",
      title: `${chapter.title} - ${book.title}`,
      description: truncateDescription(description, 180),
      images: [absoluteUrl(book.image)],
    },
  }
}

export default async function BookReaderChapterPage({ params }: PageProps) {
  const { id, chapter: chapterSlug } = await params
  const book = BOOKS_DATA.find((item) => item.id === id)
  const reader = getBookReaderIndex(id)
  const chapter = getBookReaderChapter(id, chapterSlug)

  if (!book || !reader || !chapter) {
    notFound()
  }

  const { previous, next } = getAdjacentReaderChapters(book.id, chapter.slug)
  const displayBlocks = getReaderDisplayBlocks(chapter)
  const plainText = getReaderPlainText(chapter)
  const isEnglishReader = book.id === "meet-on-the-road"
  const labels = isEnglishReader
    ? {
        home: "Home",
        onlineEdition: "Online Edition",
        scope: reader.coverage === "full" ? "full text" : "excerpt",
        headerDescription: `${book.title} ${reader.coverage === "full" ? "full text" : "excerpt"} is available to read online for free.`,
        photo: "photo",
        photos: "photos",
        aboutMinutes: "about",
        minutesSuffix: " min",
        contents: "Contents",
        buy: book.amazonLink ? "Buy on Amazon" : "Buy the book",
        previousChapter: "Previous chapter",
        nextChapter: "Next chapter",
        bookDetail: "Book detail",
        book: "Book",
        previousShort: "Prev",
        nextShort: "Next",
        detailShort: "Detail",
        mobileNav: "Mobile reading navigation",
        imageAlt: "photo",
      }
    : {
        home: "홈",
        onlineEdition: "온라인 공개본",
        scope: reader.coverage === "full" ? "전체 본문" : "전반부",
        headerDescription: `${book.title} ${reader.coverage === "full" ? "전체 본문" : "전반부"}을 무료로 공개한 온라인 독서본입니다.`,
        photo: "사진",
        photos: "사진",
        aboutMinutes: "약",
        minutesSuffix: "분",
        contents: "목차",
        buy: "종이책 구매하기",
        previousChapter: "이전 장",
        nextChapter: "다음 장",
        bookDetail: "책 상세",
        book: "책",
        previousShort: "이전",
        nextShort: "다음",
        detailShort: "상세",
        mobileNav: "모바일 독서 내비게이션",
        imageAlt: "사진",
      }
  const purchaseHref = book.naverLink || book.amazonLink
  const mediaGroupsByBlock = new Map<number, BookReaderMediaGroup[]>()
  for (const group of chapter.media ?? []) {
    const groups = mediaGroupsByBlock.get(group.afterBlock) ?? []
    groups.push(group)
    mediaGroupsByBlock.set(group.afterBlock, groups)
  }
  const firstMediaGroup = chapter.media?.[0]

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Chapter",
    "@id": `${bookChapterUrl(book.id, chapter.slug)}#chapter`,
    "url": bookChapterUrl(book.id, chapter.slug),
    "name": chapter.title,
    "position": chapter.order,
    "inLanguage": isEnglishReader ? "en" : "ko-KR",
    "isPartOf": {
      "@type": "Book",
      "@id": `${bookUrl(book.id)}#book`,
      "name": book.title,
    },
    "author": {
      "@type": "Person",
      "name": book.author,
    },
    "publisher": {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      "name": SITE_NAME,
    },
    "text": truncateDescription(plainText, 500),
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
      {
        "@type": "ListItem",
        "position": 4,
        "name": chapter.title,
        "item": bookChapterUrl(book.id, chapter.slug),
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
      <main className="native-cursor min-h-screen bg-[#f5efe5] text-[#201813]">
        <nav className="border-b border-[#201813]/15 px-6 py-5">
          <div className="mx-auto flex max-w-5xl items-center gap-3 overflow-hidden text-sm">
            <Link href="/" className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center text-[#9b3f1d] hover:underline">
              {labels.home}
            </Link>
            <span className="shrink-0 text-[#201813]/40">/</span>
            <Link href={`/books/${book.id}`} className="inline-flex min-h-11 min-w-0 items-center truncate text-[#9b3f1d] hover:underline">
              {book.title}
            </Link>
            <span className="shrink-0 text-[#201813]/40">/</span>
            <Link href={`/books/${book.id}/read`} className="inline-flex min-h-11 shrink-0 items-center text-[#9b3f1d] hover:underline">
              {labels.onlineEdition}
            </Link>
          </div>
        </nav>

        <article className="mx-auto max-w-3xl px-6 pb-28 pt-12 md:py-16">
          <header className="mb-12">
            <div className="mb-5 flex flex-wrap items-center gap-3 text-sm text-[#201813]/60">
              <span className="rounded-full bg-[#201813]/10 px-3 py-1 text-[#201813]/75">
                {chapter.part}
              </span>
              {chapter.day && <span>{chapter.day}</span>}
              {chapter.imageCount ? (
                <span>
                  {isEnglishReader
                    ? `${chapter.imageCount} ${chapter.imageCount === 1 ? labels.photo : labels.photos}`
                    : `${labels.photo} ${chapter.imageCount}장`}
                </span>
              ) : null}
              <span>{labels.aboutMinutes} {chapter.readTimeMinutes}{labels.minutesSuffix}</span>
            </div>

            <p className="mb-3 font-mono text-sm text-[#9b3f1d]">
              {String(chapter.order).padStart(2, "0")} / {reader.chapters.length}
            </p>
            <h1 className="font-playfair text-4xl font-normal leading-tight md:text-5xl">
              {chapter.title}
            </h1>
            <p className="mt-5 text-sm leading-7 text-[#201813]/60">
              {labels.headerDescription}
            </p>
          </header>

          <div className="book-reader-prose text-[17px] leading-8 text-[#201813]/88 md:text-lg md:leading-9">
            {displayBlocks.map((block, blockIndex) => (
              <Fragment key={blockIndex}>
                <p
                  className={
                    block.preserveLines
                      ? "mb-8 whitespace-pre-line leading-9 md:leading-10"
                      : "mb-7"
                  }
                >
                  {block.text}
                </p>
                {block.sourceBlockIndexes.flatMap((sourceBlockIndex) =>
                  (mediaGroupsByBlock.get(sourceBlockIndex) ?? []).map((group, groupIndex) => (
                    <ReaderPhotoGroup
                      key={`${sourceBlockIndex}-${groupIndex}`}
                      group={group}
                      chapterTitle={chapter.title}
                      imageAlt={labels.imageAlt}
                      priority={group === firstMediaGroup}
                    />
                  ))
                )}
              </Fragment>
            ))}
          </div>

          <footer className="mt-16 border-t border-[#201813]/15 pt-8">
            <div className="mb-8 flex flex-wrap gap-3">
              <Link
                href={`/books/${book.id}/read`}
                className="inline-flex items-center gap-2 rounded-md border border-[#201813]/20 px-4 py-3 text-sm font-medium text-[#201813] transition-colors hover:bg-[#201813]/8"
              >
                <List className="h-4 w-4" />
                {labels.contents}
              </Link>

              {purchaseHref && (
                <a
                  href={purchaseHref}
                  target="_blank"
                  rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md bg-[#b84f22] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#9b3f1d]"
              >
                <ShoppingBag className="h-4 w-4" />
                {labels.buy}
              </a>
            )}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {previous ? (
                <Link
                  href={`/books/${book.id}/read/${previous.slug}`}
                  className="group rounded-md border border-[#201813]/15 p-4 transition-colors hover:border-[#9b3f1d]"
                >
                  <span className="mb-2 flex items-center gap-2 text-sm text-[#201813]/55">
                    <ChevronLeft className="h-4 w-4" />
                    {labels.previousChapter}
                  </span>
                  <span className="font-medium group-hover:text-[#9b3f1d]">
                    {previous.title}
                  </span>
                </Link>
              ) : (
                <div />
              )}

              {next ? (
                <Link
                  href={`/books/${book.id}/read/${next.slug}`}
                  className="group rounded-md border border-[#201813]/15 p-4 text-right transition-colors hover:border-[#9b3f1d]"
                >
                  <span className="mb-2 flex items-center justify-end gap-2 text-sm text-[#201813]/55">
                    {labels.nextChapter}
                    <ChevronRight className="h-4 w-4" />
                  </span>
                  <span className="font-medium group-hover:text-[#9b3f1d]">
                    {next.title}
                  </span>
                </Link>
              ) : (
                <Link
                  href={`/books/${book.id}`}
                  className="group rounded-md border border-[#201813]/15 p-4 text-right transition-colors hover:border-[#9b3f1d]"
                >
                  <span className="mb-2 flex items-center justify-end gap-2 text-sm text-[#201813]/55">
                    {labels.bookDetail}
                    <BookOpen className="h-4 w-4" />
                  </span>
                  <span className="font-medium group-hover:text-[#9b3f1d]">
                    {book.title}
                  </span>
                </Link>
              )}
            </div>
          </footer>
        </article>

        <nav
          aria-label={labels.mobileNav}
          className="fixed inset-x-0 bottom-0 z-40 border-t border-[#201813]/15 bg-[#f5efe5]/95 px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-2 shadow-[0_-18px_48px_rgba(32,24,19,0.12)] backdrop-blur md:hidden"
        >
          <div className="mx-auto grid max-w-md grid-cols-3 gap-2">
            {previous ? (
              <Link
                href={`/books/${book.id}/read/${previous.slug}`}
                className="inline-flex min-h-11 items-center justify-center gap-1 rounded-md border border-[#201813]/15 px-2 text-sm font-medium text-[#201813]/75"
              >
                <ChevronLeft className="h-4 w-4" />
                {labels.previousShort}
              </Link>
            ) : (
              <Link
                href={`/books/${book.id}`}
                className="inline-flex min-h-11 items-center justify-center gap-1 rounded-md border border-[#201813]/15 px-2 text-sm font-medium text-[#201813]/75"
              >
                <BookOpen className="h-4 w-4" />
                {labels.book}
              </Link>
            )}

            <Link
              href={`/books/${book.id}/read`}
              className="inline-flex min-h-11 items-center justify-center gap-1 rounded-md bg-[#201813] px-2 text-sm font-semibold text-white"
            >
              <List className="h-4 w-4" />
              {labels.contents}
            </Link>

            {next ? (
              <Link
                href={`/books/${book.id}/read/${next.slug}`}
                className="inline-flex min-h-11 items-center justify-center gap-1 rounded-md border border-[#201813]/15 px-2 text-sm font-medium text-[#201813]/75"
              >
                {labels.nextShort}
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <Link
                href={`/books/${book.id}`}
                className="inline-flex min-h-11 items-center justify-center gap-1 rounded-md border border-[#201813]/15 px-2 text-sm font-medium text-[#201813]/75"
              >
                {labels.detailShort}
                <BookOpen className="h-4 w-4" />
              </Link>
            )}
          </div>
        </nav>
      </main>
    </>
  )
}

function ReaderPhotoGroup({
  group,
  chapterTitle,
  imageAlt,
  priority = false,
}: {
  group: BookReaderMediaGroup
  chapterTitle: string
  imageAlt: string
  priority?: boolean
}) {
  return (
    <figure className="my-10 md:my-12">
      <div className="grid gap-5 md:gap-6">
        {group.images.map((image) => (
          <Image
            key={image.src}
            src={image.src}
            alt={image.alt || `${chapterTitle} ${imageAlt}`}
            width={image.width}
            height={image.height}
            priority={priority}
            unoptimized
            draggable={false}
            className={
              image.src.includes("/sketches/")
                ? "h-auto w-full mix-blend-multiply"
                : "h-auto w-full rounded-sm shadow-[0_18px_50px_rgba(32,24,19,0.14)]"
            }
            sizes="(max-width: 768px) 100vw, 720px"
          />
        ))}
      </div>
      {group.caption && (
        <figcaption className="mt-3 text-center text-xs leading-5 text-[#201813]/50">
          {group.caption}
        </figcaption>
      )}
    </figure>
  )
}
