import Link from "next/link"
import Image from "next/image"
import { notFound } from "next/navigation"
import { Metadata } from "next"
import { CustomCursor } from "@/components/custom-cursor"
import {
  AUTHORS,
  getAuthorBooks,
  getAuthorBySlug,
  getAuthorColumns,
} from "@/lib/authors-data"
import {
  absoluteUrl,
  authorUrl,
  SITE_NAME,
  SITE_URL,
  truncateDescription,
} from "@/lib/site-config"

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return AUTHORS.map((author) => ({ slug: author.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const author = getAuthorBySlug(slug)

  if (!author) {
    return { title: "저자를 찾을 수 없습니다" }
  }

  return {
    title: `${author.name} - ${author.jobTitle} | ${SITE_NAME}`,
    description: truncateDescription(author.bio),
    keywords: [
      author.name,
      `${author.name} 작가`,
      author.jobTitle,
      "생각을 나누다",
      "나누다 출판사",
      "여행 에세이",
    ],
    authors: [{ name: author.name }],
    alternates: {
      canonical: authorUrl(author.slug),
    },
    openGraph: {
      title: `${author.name} - ${author.jobTitle}`,
      description: truncateDescription(author.bio, 180),
      url: authorUrl(author.slug),
      siteName: SITE_NAME,
      type: "profile",
      locale: "ko_KR",
      images: [
        {
          url: absoluteUrl("/images/og-image-1.png"),
          width: 1200,
          height: 630,
          alt: `${author.name} 저자 소개`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${author.name} - ${author.jobTitle}`,
      description: truncateDescription(author.bio, 180),
      images: [absoluteUrl("/images/og-image-1.png")],
    },
  }
}

export default async function AuthorPage({ params }: PageProps) {
  const { slug } = await params
  const author = getAuthorBySlug(slug)

  if (!author) {
    notFound()
  }

  const books = getAuthorBooks(author)
  const columns = getAuthorColumns(author)
  const alternateNames = author.nameVariants.filter((name) => name !== author.name)

  // JSON-LD: 내부 정적 데이터만 JSON.stringify로 직렬화 (사용자 입력 없음).
  // 저장소 전역(layout/book/column)에서 쓰는 표준 구조화 데이터 주입 패턴.
  const personJsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${authorUrl(author.slug)}#person`,
    "name": author.name,
    ...(alternateNames.length ? { "alternateName": alternateNames } : {}),
    "jobTitle": author.jobTitle,
    "description": author.bio,
    "url": authorUrl(author.slug),
    "worksFor": {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
    },
    ...(books.length
      ? { "knowsAbout": Array.from(new Set(books.map((book) => book.category))) }
      : {}),
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
        "name": "저자",
        "item": `${SITE_URL}/authors/${author.slug}`,
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": author.name,
        "item": authorUrl(author.slug),
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <div className="min-h-screen bg-primary-dark text-text-light">
        <CustomCursor />

        {/* Breadcrumb */}
        <nav aria-label="브레드크럼" className="p-6 border-b border-text-gray/20">
          <ol className="flex flex-wrap items-center gap-2 text-sm text-text-gray">
            <li>
              <Link href="/" className="inline-flex min-h-11 min-w-11 items-center justify-center hover:text-text-light transition-colors cursor-pointer">
                홈
              </Link>
            </li>
            <li aria-hidden="true" className="text-text-gray/40">/</li>
            <li aria-current="page" className="text-text-light">{author.name}</li>
          </ol>
        </nav>

        <div className="max-w-4xl mx-auto px-6 py-16">
          {/* Header */}
          <header className="mb-16">
            <p className="text-sm font-medium text-accent-orange mb-3">{author.jobTitle}</p>
            <h1 className="font-playfair text-5xl lg:text-6xl font-light mb-6">{author.name}</h1>
            <p className="text-lg text-text-gray leading-relaxed max-w-3xl">{author.bio}</p>
          </header>

          {/* Books */}
          {books.length > 0 && (
            <section className="mb-16">
              <h2 className="font-playfair text-3xl font-normal mb-8">저서</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                {books.map((book) => (
                  <Link key={book.id} href={`/books/${book.id}`} className="group flex gap-5 cursor-pointer">
                    <div className="relative h-36 w-24 shrink-0 overflow-hidden rounded shadow-lg">
                      <Image
                        src={book.image}
                        alt={`${book.title} 표지`}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="96px"
                      />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold leading-snug group-hover:text-accent-orange transition-colors">
                        {book.title}
                      </h3>
                      <p className="mt-1 text-sm text-text-gray">{book.subtitle}</p>
                      <p className="mt-2 text-xs text-text-gray/70">{book.category} · {book.publishDate}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Columns */}
          {columns.length > 0 && (
            <section>
              <h2 className="font-playfair text-3xl font-normal mb-8">칼럼</h2>
              <ul className="divide-y divide-text-gray/15 border-y border-text-gray/15">
                {columns.map((post) => (
                  <li key={post.id}>
                    <Link href={`/column/${post.id}`} className="group flex items-baseline justify-between gap-4 py-5 cursor-pointer">
                      <span className="min-w-0">
                        <span className="block font-medium group-hover:text-accent-orange transition-colors">
                          {post.title}
                        </span>
                        <span className="mt-1 block text-sm text-text-gray line-clamp-1">{post.excerpt}</span>
                      </span>
                      <span className="shrink-0 text-xs text-text-gray/70 whitespace-nowrap">{post.date}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  )
}
