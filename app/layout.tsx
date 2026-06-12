import type { Metadata } from 'next'
import { BOOKS_DATA } from '@/lib/books-data'
import {
  absoluteUrl,
  bookUrl,
  COMPANY_NAME,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_NAME,
  SITE_URL,
  SOCIAL_LINKS,
  splitAuthors,
} from '@/lib/site-config'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: '생각을나누다 - 여행 에세이 출판사 | 나누다컴퍼니',
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  applicationName: SITE_NAME,
  category: 'books',
  authors: [{ name: '이상민' }, { name: '정예원' }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  openGraph: {
    title: '생각을나누다 - 여행 에세이 출판사 | 나누다컴퍼니',
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    images: [
      {
        url: '/images/og-image-1.png',
        width: 1200,
        height: 630,
        alt: '생각을나누다 여행 에세이 출판 브랜드',
      },
    ],
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '생각을나누다 - 여행 에세이 출판사',
    description: SITE_DESCRIPTION,
    images: ['/images/og-image-1.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'X8oYSjNwvMWdubK0XZudGSaVI6pT1OciHfD52nnPDI0',
    other: {
      'naver-site-verification': '04883e7ad65c3ae3e35e250b13a451a4',
    },
  },
  alternates: {
    canonical: SITE_URL,
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
}

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  "name": COMPANY_NAME,
  "alternateName": [SITE_NAME, "나누다출판", "도서출판 생각을나누다"],
  "url": SITE_URL,
  "logo": {
    "@type": "ImageObject",
    "url": absoluteUrl('/images/nanuda_logo.png'),
  },
  "image": absoluteUrl('/images/og-image-1.png'),
  "description": SITE_DESCRIPTION,
  "foundingDate": "2021",
  "founder": [
    {
      "@type": "Person",
      "name": "이상민",
    },
    {
      "@type": "Person",
      "name": "정예원",
    },
  ],
  "brand": {
    "@type": "Brand",
    "name": SITE_NAME,
  },
  "areaServed": "KR",
  "sameAs": SOCIAL_LINKS,
  "contactPoint": {
    "@type": "ContactPoint",
    "email": "simon@nanudacompany.com",
    "contactType": "publishing inquiries",
    "availableLanguage": ["ko", "en"],
  },
  "knowsAbout": [
    "여행 에세이",
    "가족 여행기",
    "남미 여행",
    "히말라야 트레킹",
    "올레길 여행",
    "영문 여행 회고록",
  ],
  "hasOfferCatalog": {
    "@type": "OfferCatalog",
    "name": "생각을나누다 여행 에세이 도서",
    "itemListElement": BOOKS_DATA.map((book, index) => ({
      "@type": "Offer",
      "position": index + 1,
      "itemOffered": {
        "@type": "Book",
        "@id": `${bookUrl(book.id)}#book`,
        "name": book.title,
        "url": bookUrl(book.id),
        "author": splitAuthors(book.author).map((name) => ({
          "@type": "Person",
          "name": name,
        })),
        "genre": book.category,
        "image": absoluteUrl(book.image),
        "description": book.description,
      },
    })),
  },
}

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  "url": SITE_URL,
  "name": SITE_NAME,
  "alternateName": COMPANY_NAME,
  "description": SITE_DESCRIPTION,
  "inLanguage": ["ko-KR", "en"],
  "publisher": {
    "@id": `${SITE_URL}/#organization`,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="icon" href="/images/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/images/nanuda_logo.png" />
        <meta name="theme-color" content="#D97706" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd)
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(websiteJsonLd)
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
