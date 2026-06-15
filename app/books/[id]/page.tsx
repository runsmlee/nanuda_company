import { BOOKS_DATA } from "@/lib/books-data"
import { CustomCursor } from "@/components/custom-cursor"
import Link from "next/link"
import { Metadata } from "next"
import BookDetailClient from "./book-detail-client"
import { getBookReaderIndex } from "@/lib/book-reader"
import {
  absoluteUrl,
  bookChapterUrl,
  bookPublishedDate,
  bookUrl,
  parseBookPrice,
  SITE_NAME,
  SITE_URL,
  splitAuthors,
  truncateDescription,
} from "@/lib/site-config"

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const book = BOOKS_DATA.find((book) => book.id === id)

  if (!book) {
    return {
      title: "책을 찾을 수 없습니다 - 생각을 나누다",
      description: "요청하신 책을 찾을 수 없습니다.",
    }
  }

  return {
    title: `${book.title} - ${book.subtitle} | 생각을 나누다`,
    description: truncateDescription(book.description),
    keywords: [
      book.title,
      book.subtitle,
      book.author,
      book.category,
      '생각을 나누다',
      '나누다 출판사',
      '여행 에세이',
      '여행서',
      book.title.includes('여행') ? '여행기' : '',
      book.author === '이상민' ? '이상민 작가' : '',
      book.author === '정예원' ? '정예원 작가' : '',
    ].filter(Boolean),
    authors: splitAuthors(book.author).map((name) => ({ name })),
    openGraph: {
      title: `${book.title} - ${book.subtitle}`,
      description: truncateDescription(book.description, 180),
      url: bookUrl(book.id),
      siteName: SITE_NAME,
      images: [
        {
          url: absoluteUrl(book.image),
          width: 800,
          height: 1200,
          alt: `${book.title} 표지`,
        },
      ],
      type: 'book',
      locale: book.id === "meet-on-the-road" ? "en_US" : "ko_KR",
    },
    twitter: {
      card: 'summary_large_image',
      title: `${book.title} - ${book.subtitle}`,
      description: truncateDescription(book.description, 180),
      images: [absoluteUrl(book.image)],
    },
    alternates: {
      canonical: bookUrl(book.id),
    },
  }
}

export async function generateStaticParams() {
  return BOOKS_DATA.map((book) => ({
    id: book.id,
  }))
}

export default async function BookDetailPage({ params }: PageProps) {
  const { id } = await params
  const book = BOOKS_DATA.find((book) => book.id === id)

  if (!book) {
    return (
      <div className="min-h-screen bg-primary-dark text-text-light flex items-center justify-center">
        <CustomCursor />
        <div className="text-center">
          <h1 className="text-4xl font-playfair mb-4">책을 찾을 수 없습니다</h1>
          <Link href="/" className="text-accent-orange hover:underline cursor-pointer">
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    )
  }

  const authorJsonLd = splitAuthors(book.author).map((name) => ({
    "@type": "Person",
    "name": name,
  }))
  const reader = getBookReaderIndex(book.id)
  const primaryOfferUrl = book.naverLink || book.amazonLink || bookUrl(book.id)
  const { price, priceCurrency } = parseBookPrice(book.price)

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Book",
    "@id": `${bookUrl(book.id)}#book`,
    "url": bookUrl(book.id),
    "name": book.title,
    "alternateName": book.subtitle,
    "author": authorJsonLd,
    "description": book.description,
    "genre": book.category,
    "numberOfPages": book.pages,
    "datePublished": bookPublishedDate(book),
    "inLanguage": book.id === "meet-on-the-road" ? "en" : "ko-KR",
    "publisher": {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      "name": SITE_NAME
    },
    "image": absoluteUrl(book.image),
    ...(reader ? {
      "hasPart": reader.chapters.map((chapter) => ({
        "@type": "Chapter",
        "position": chapter.order,
        "name": chapter.title,
        "url": bookChapterUrl(book.id, chapter.slug)
      }))
    } : {}),
    ...(book.naverLink || book.amazonLink ? {
      "offers": {
        "@type": "Offer",
        "price": price,
        "priceCurrency": priceCurrency,
        "availability": "https://schema.org/InStock",
        "url": primaryOfferUrl,
        "seller": {
          "@type": "Organization",
          "name": primaryOfferUrl.includes("amazon") ? "Amazon" : "Naver Shopping"
        }
      }
    } : {})
  }

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "홈",
        "item": "https://www.nanudacompany.com"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "도서",
        "item": `${SITE_URL}/#books`
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": book.title,
        "item": bookUrl(book.id)
      }
    ]
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
      <div className="min-h-screen bg-primary-dark text-text-light">
        <CustomCursor />

        {/* Navigation */}
        <nav className="p-6 border-b border-text-gray/20">
          <Link href="/" className="text-accent-orange hover:underline cursor-pointer">
            ← 홈으로 돌아가기
          </Link>
        </nav>

        <BookDetailClient book={book} />
      </div>
    </>
  )
}
