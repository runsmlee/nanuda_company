import { Metadata } from "next"
import Link from "next/link"
import { CustomCursor } from "@/components/custom-cursor"
import { BLOG_POSTS } from "@/lib/blog-data"
import {
  absoluteUrl,
  columnUrl,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
} from "@/lib/site-config"
import ColumnListClient from "./column-list-client"

export const metadata: Metadata = {
  title: '나누다 칼럼 - 여행과 일상의 에세이 | 생각을나누다',
  description: '생각을나누다 칼럼은 여행과 일상, 책과 가족의 순간에서 발견한 생각을 에세이로 나누는 공간입니다.',
  keywords: [
    '나누다 칼럼',
    '여행 에세이',
    '글쓰기',
    '여행 철학',
    '육아 여행',
    '독서',
    '책 이야기',
    '생각을 나누다',
    '나누다 출판사',
    '이상민',
    '정예원',
    '여행기',
    '여행 블로그',
    '에세이 블로그'
  ],
  openGraph: {
    title: '나누다 칼럼 - 여행과 일상의 에세이 | 생각을나누다',
    description: '여행과 일상에서 마주한 특별한 이야기를 나누는 생각을나누다 칼럼입니다.',
    url: `${SITE_URL}/column`,
    siteName: SITE_NAME,
    images: [
      {
        url: absoluteUrl('/images/og-image-1.png'),
        width: 1200,
        height: 630,
        alt: '나누다 칼럼',
      },
    ],
    type: 'website',
    locale: 'ko_KR',
  },
  alternates: {
    canonical: `${SITE_URL}/column`,
  },
}

export default function ColumnListPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "@id": `${SITE_URL}/column#blog`,
    "name": "나누다 칼럼",
    "description": SITE_DESCRIPTION,
    "url": `${SITE_URL}/column`,
    "inLanguage": "ko-KR",
    "isPartOf": {
      "@id": `${SITE_URL}/#website`
    },
    "author": {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      "name": "나누다컴퍼니"
    },
    "publisher": {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      "name": "나누다컴퍼니"
    },
    "blogPost": BLOG_POSTS.map(post => ({
      "@type": "BlogPosting",
      "@id": `${columnUrl(post.id)}#article`,
      "headline": post.title,
      "description": post.excerpt,
      "datePublished": post.date,
      "dateModified": post.date,
      "author": {
        "@type": "Person",
        "name": post.author
      },
      "publisher": {
        "@id": `${SITE_URL}/#organization`
      },
      "image": absoluteUrl(post.image),
      "url": columnUrl(post.id),
      "mainEntityOfPage": columnUrl(post.id)
    }))
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

        {/* Header */}
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="text-center mb-16">
            <h1 className="font-playfair text-5xl lg:text-6xl font-light mb-6">나누다 칼럼</h1>
            <p className="text-xl text-text-gray max-w-3xl mx-auto leading-relaxed">
              일상의 모든 순간이 여행이 되고 이야기가 됩니다.
              또다른 이야기가 나눠지는 곳.
            </p>
          </div>

          <ColumnListClient />
        </div>
      </div>
    </>
  )
}
