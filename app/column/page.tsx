import { Metadata } from "next"
import Link from "next/link"
import { CustomCursor } from "@/components/custom-cursor"
import { BLOG_POSTS } from "@/lib/blog-data"
import ColumnListClient from "./column-list-client"

export const metadata: Metadata = {
  title: '나누다 칼럼 - 나누고 싶은 이야기 | 생각을나누다',
  description: '여행 뿐만 아니라 일상에서 마주한 특별한 순간들을 나눕니다.',
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
    title: '나누다 칼럼 - 나누고 싶은 이야기 | 생각을나누다',
    description: '여행 이야기, 일상의 이야기를 나누다.',
    images: [
      {
        url: '/images/nanuda_logo.png',
        width: 1200,
        height: 630,
        alt: '나누다 칼럼',
      },
    ],
    type: 'website',
  },
}

export default function ColumnListPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "name": "나누다 칼럼",
    "description": "여행 이야기, 일상의 이야기를 나누다.",
    "url": "https://nanudacompany.com.kr/column",
    "author": {
      "@type": "Organization",
      "name": "나누다컴퍼니"
    },
    "publisher": {
      "@type": "Organization",
      "name": "나누다컴퍼니",
      "logo": {
        "@type": "ImageObject",
        "url": "https://nanudacompany.com.kr/images/nanuda_logo.png"
      }
    },
    "blogPost": BLOG_POSTS.map(post => ({
      "@type": "BlogPosting",
      "headline": post.title,
      "description": post.excerpt,
      "datePublished": post.date,
      "author": {
        "@type": "Person",
        "name": post.author
      },
      "image": post.image,
      "url": `https://nanudacompany.com.kr/column/${post.id}`
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
            <h2 className="text-xl text-text-gray max-w-3xl mx-auto leading-relaxed">
              일상의 모든 순간이 여행이 되고 이야기가 됩니다. 
              또다른 이야기가 나눠지는 곳.
            </h2>
            
            {/* SEO를 위한 숨겨진 키워드 */}
            <div className="sr-only">
              <h3>주요 칼럼 카테고리</h3>
              <ul>
                <li>여행 이야기</li>
                <li>일상의 이야기</li>
                <li>가족 이야기</li>
                <li>독서 이야기</li>
                <li>일상의 특별한 순간들</li>
              </ul>
            </div>
          </div>

          <ColumnListClient />
        </div>
      </div>
    </>
  )
}
