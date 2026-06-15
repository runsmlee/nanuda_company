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

  const description = truncateDescription(getReaderPlainText(chapter), 155)

  return {
    title: `${chapter.title} - ${book.title} 온라인 공개본 | ${SITE_NAME}`,
    description,
    keywords: [
      book.title,
      chapter.title,
      chapter.part,
      `${book.title} 온라인 읽기`,
      `${book.title} 무료 공개본`,
      book.subtitle,
      book.category,
      "여행 에세이",
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
      locale: "ko_KR",
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
  const mediaGroupsByBlock = new Map<number, BookReaderMediaGroup[]>()
  for (const group of chapter.media ?? []) {
    const groups = mediaGroupsByBlock.get(group.afterBlock) ?? []
    groups.push(group)
    mediaGroupsByBlock.set(group.afterBlock, groups)
  }
  const firstMediaGroup = chapter.media?.[0]
  const isFullReader = reader.coverage === "full"
  const scopeLabel = isFullReader ? "전체 본문" : "전반부"

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Chapter",
    "@id": `${bookChapterUrl(book.id, chapter.slug)}#chapter`,
    "url": bookChapterUrl(book.id, chapter.slug),
    "name": chapter.title,
    "position": chapter.order,
    "inLanguage": "ko-KR",
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
            <Link href="/" className="shrink-0 text-[#9b3f1d] hover:underline">
              홈
            </Link>
            <span className="shrink-0 text-[#201813]/40">/</span>
            <Link href={`/books/${book.id}`} className="min-w-0 truncate text-[#9b3f1d] hover:underline">
              {book.title}
            </Link>
            <span className="shrink-0 text-[#201813]/40">/</span>
            <Link href={`/books/${book.id}/read`} className="shrink-0 text-[#9b3f1d] hover:underline">
              온라인 공개본
            </Link>
          </div>
        </nav>

        <article className="mx-auto max-w-3xl px-6 py-12 md:py-16">
          <header className="mb-12">
            <div className="mb-5 flex flex-wrap items-center gap-3 text-sm text-[#201813]/60">
              <span className="rounded-full bg-[#201813]/10 px-3 py-1 text-[#201813]/75">
                {chapter.part}
              </span>
              {chapter.day && <span>{chapter.day}</span>}
              {chapter.imageCount ? <span>사진 {chapter.imageCount}장</span> : null}
              <span>약 {chapter.readTimeMinutes}분</span>
            </div>

            <p className="mb-3 font-mono text-sm text-[#9b3f1d]">
              {String(chapter.order).padStart(2, "0")} / {reader.chapters.length}
            </p>
            <h1 className="font-playfair text-4xl font-normal leading-tight md:text-5xl">
              {chapter.title}
            </h1>
            <p className="mt-5 text-sm leading-7 text-[#201813]/60">
              {book.title} {scopeLabel}을 무료로 공개한 온라인 독서본입니다.
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
                목차
              </Link>

              {book.naverLink && (
                <a
                  href={book.naverLink}
                  target="_blank"
                  rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md bg-[#b84f22] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#9b3f1d]"
              >
                <ShoppingBag className="h-4 w-4" />
                종이책 구매하기
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
                    이전 장
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
                    다음 장
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
                    책 상세
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
      </main>
    </>
  )
}

function ReaderPhotoGroup({
  group,
  chapterTitle,
  priority = false,
}: {
  group: BookReaderMediaGroup
  chapterTitle: string
  priority?: boolean
}) {
  return (
    <figure className="my-10 md:my-12">
      <div className="grid gap-5 md:gap-6">
        {group.images.map((image) => (
          <Image
            key={image.src}
            src={image.src}
            alt={image.alt || `${chapterTitle} 사진`}
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
