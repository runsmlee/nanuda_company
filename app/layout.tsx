import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://nanudacompany.com.kr'),
  title: '생각을나누다 | 여행기 출판',
  description: '출판사 생각을나누다는 우리의 가치 있는 경험과 생각을 담습니다. 우리의 이야기가 누군가에게 영감의 씨앗이 됩니다. 길에서 만나다, 자라고 싶은 아이 아이이고 싶은 어른, 한 걸음에 모든 행복이 담겨있다, 안나푸르나에서 보내는 편지, Meet On The Road 등 감동적인 여행 에세이를 만나보세요.',
  keywords: [
    '위클리벤처스',
    '생각을나누다',
    '나누다출판',
    '나누다컴퍼니',
    '여행 에세이',
    '가족 여행기',
    '길에서 만나다',
    '자라고 싶은 아이 아이이고 싶은 어른',
    '한 걸음에 모든 행복이 담겨있다',
    '안나푸르나에서 보내는 편지',
    'Meet On The Road',
    '남미 여행',
    '히말라야 트레킹',
    '올레길 여행',
    '세계여행',
    '이상민',
    '정예원',
    '여행서',
    '에세이',
    '육아서',
    '가족 여행',
    '청춘 여행기'
  ],
  authors: [{ name: '이상민' }, { name: '정예원' }],
  creator: '생각을나누다',
  publisher: '생각을나누다',
  openGraph: {
    title: '도서출판 생각을나누다 - 나누다컴퍼니',
    description: '우리의 가치 있는 경험과 생각을 담은 여행 에세이. 길에서 만나다, 자라고 싶은 아이 아이이고 싶은 어른, 한 걸음에 모든 행복이 담겨있다, 안나푸르나에서 보내는 편지 등',
    url: 'https://nanudacompany.com',
    siteName: '생각을 나누다',
    images: [
      {
        url: '/images/nanuda_logo.png',
        width: 1200,
        height: 630,
        alt: '생각을나누다 로고',
      },
    ],
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '도서출판 생각을나누다 - 나누다컴퍼니',
    description: '우리의 가치 있는 경험과 생각을 담은 여행 에세이',
    images: ['/images/nanuda_logo.png'],
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
    google: 'google-site-verification=X8oYSjNwvMWdubK0XZudGSaVI6pT1OciHfD52nnPDI0',  // 실제 Google Search Console에서 제공받은 코드로 교체 필요
    other: {
      'naver-site-verification': 'naver04883e7ad65c3ae3e35e250b13a451a4',  // 기존 Naver 검증 파일명과 일치
    },
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
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "나누다컴퍼니",
              "alternateName": "생각을나누다",
              "url": "https://nanudacompany.com.kr",
              "logo": "https://nanudacompany.com.kr/images/nanuda_logo.png",
              "description": "생각을나누다는 우리의 가치 있는 경험과 생각을 담습니다. 우리의 이야기가 누군가에게 영감의 씨앗이 됩니다.",
              "foundingDate": "2021",
              "founder": {
                "@type": "Person",
                "name": "이상민"
              },
              "sameAs": [
                "https://www.instagram.com/mindful_journey_one/"
              ],
              "hasOfferCatalog": {
                "@type": "OfferCatalog",
                "name": "여행 에세이 도서",
                "itemListElement": [
                  {
                    "@type": "Book",
                    "name": "길에서 만나다",
                    "author": "이상민",
                    "genre": "여행 에세이",
                    "description": "남미 여행 중 도둑을 맞고 비로소 시작된 저자의 진짜 여행"
                  },
                  {
                    "@type": "Book",
                    "name": "자라고 싶은 아이, 아이이고 싶은 어른",
                    "author": "이상민",
                    "genre": "가족 여행",
                    "description": "아빠와 아들이 함께 떠나는 올레길 여행"
                  },
                  {
                    "@type": "Book",
                    "name": "한 걸음에 모든 행복이 담겨있다",
                    "author": ["이상민", "정예원"],
                    "genre": "가족 여행",
                    "description": "회사를 그만두고 훌쩍 떠난 가족의 세계여행 이야기"
                  },
                  {
                    "@type": "Book",
                    "name": "안나푸르나에서 보내는 편지",
                    "author": "이상민",
                    "genre": "여행 에세이",
                    "description": "히말라야에서 보내는 아빠의 편지"
                  },
                  {
                    "@type": "Book",
                    "name": "Meet On The Road",
                    "author": "Sangmin Lee",
                    "genre": "Travel Memoir",
                    "description": "A Journey through South America (English Edition)"
                  }
                ]
              }
            })
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
