import { HomePageClient } from "@/app/home-page-client"
import { BLOG_POSTS } from "@/lib/blog-data"
import { BOOKS_DATA } from "@/lib/books-data"
import {
  absoluteUrl,
  bookUrl,
  columnUrl,
  FAQ_ITEMS,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  splitAuthors,
} from "@/lib/site-config"

const homePageJsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "@id": `${SITE_URL}/#homepage`,
  "url": SITE_URL,
  "name": `${SITE_NAME} - 여행 에세이 출판사`,
  "description": SITE_DESCRIPTION,
  "inLanguage": "ko-KR",
  "isPartOf": {
    "@id": `${SITE_URL}/#website`,
  },
  "about": [
    "여행 에세이",
    "가족 여행기",
    "남미 여행",
    "히말라야 트레킹",
    "올레길 여행",
  ],
  "mainEntity": {
    "@type": "ItemList",
    "name": "생각을나누다 대표 도서",
    "numberOfItems": BOOKS_DATA.length,
    "itemListElement": BOOKS_DATA.map((book, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "url": bookUrl(book.id),
      "item": {
        "@type": "Book",
        "@id": `${bookUrl(book.id)}#book`,
        "name": book.title,
        "author": splitAuthors(book.author).map((name) => ({
          "@type": "Person",
          "name": name,
        })),
        "image": absoluteUrl(book.image),
        "description": book.description,
        "genre": book.category,
      },
    })),
  },
}

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": `${SITE_URL}/#faq`,
  "mainEntity": FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    "name": item.question,
    "acceptedAnswer": {
      "@type": "Answer",
      "text": item.answer,
    },
  })),
}

const blogItemListJsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  "@id": `${SITE_URL}/#columns`,
  "name": "생각을나누다 칼럼",
  "itemListElement": BLOG_POSTS.map((post, index) => ({
    "@type": "ListItem",
    "position": index + 1,
    "url": columnUrl(post.id),
    "name": post.title,
    "description": post.excerpt,
  })),
}

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homePageJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogItemListJsonLd) }}
      />
      <HomePageClient />
    </>
  )
}
