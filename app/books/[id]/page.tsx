import { BOOKS_DATA } from "@/lib/books-data"
import { CustomCursor } from "@/components/custom-cursor"
import Link from "next/link"
import { Metadata } from "next"
import BookDetailClient from "./book-detail-client"

interface PageProps {
  params: { id: string }
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
    description: `${book.description.substring(0, 160)}...`,
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
    authors: [{ name: book.author }],
    openGraph: {
      title: `${book.title} - ${book.subtitle}`,
      description: book.description,
      images: [
        {
          url: book.image,
          width: 800,
          height: 1200,
          alt: `${book.title} 표지`,
        },
      ],
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${book.title} - ${book.subtitle}`,
      description: book.description,
      images: [book.image],
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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Book",
    "name": book.title,
    "author": {
      "@type": "Person",
      "name": book.author
    },
    "description": book.description,
    "genre": book.category,
    "numberOfPages": book.pages,
    "datePublished": book.publishDate,
    "publisher": {
      "@type": "Organization",
      "name": "나누다 출판사"
    },
    "image": book.image,
    "offers": {
      "@type": "Offer",
      "price": book.price.replace(/[^0-9]/g, ''),
      "priceCurrency": book.price.includes('$') ? 'USD' : 'KRW',
      "availability": "https://schema.org/InStock",
      "url": book.naverLink || book.amazonLink
    }
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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
