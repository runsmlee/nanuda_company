import { type Book } from "@/lib/books-data"

export const SITE_URL = "https://www.nanudacompany.com"
export const SITE_NAME = "생각을나누다"
export const COMPANY_NAME = "나누다컴퍼니"
export const SITE_UPDATED_AT = "2026-06-12"

export const SITE_DESCRIPTION =
  "생각을나누다는 나누다컴퍼니의 여행 에세이 출판 브랜드입니다. 길에서 만나다, 한 걸음에 모든 행복이 담겨있다, 안나푸르나에서 보내는 편지 등을 소개합니다."

export const SITE_KEYWORDS = [
  "생각을나누다",
  "나누다컴퍼니",
  "나누다출판",
  "도서출판 생각을나누다",
  "여행 에세이",
  "여행기",
  "가족 여행기",
  "청춘 여행기",
  "남미 여행",
  "히말라야 트레킹",
  "올레길 여행",
  "세계여행",
  "이상민 작가",
  "정예원 작가",
]

export const SOCIAL_LINKS = [
  "https://www.instagram.com/mindful_journey_one/",
]

export const FAQ_ITEMS = [
  {
    question: "생각을나누다는 어떤 출판 브랜드인가요?",
    answer:
      "생각을나누다는 나누다컴퍼니가 운영하는 출판 브랜드로, 여행과 가족의 경험에서 발견한 생각을 여행 에세이와 칼럼으로 나눕니다.",
  },
  {
    question: "어떤 책을 출간했나요?",
    answer:
      "길에서 만나다, 자라고 싶은 아이 아이이고 싶은 어른, 한 걸음에 모든 행복이 담겨있다, 안나푸르나에서 보내는 편지, Meet On The Road를 소개하고 있습니다.",
  },
  {
    question: "책은 어디에서 구매할 수 있나요?",
    answer:
      "국문 도서는 각 도서 상세 페이지의 네이버쇼핑 링크에서, 영문 도서 Meet On The Road는 Amazon 링크에서 구매할 수 있습니다.",
  },
  {
    question: "출판 문의는 어떻게 하나요?",
    answer:
      "홈페이지 하단의 출판 문의 버튼을 이용하거나 simon@nanudacompany.com으로 문의할 수 있습니다.",
  },
]

export function absoluteUrl(path = "") {
  if (!path) return SITE_URL
  if (path.startsWith("http://") || path.startsWith("https://")) return path

  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${SITE_URL}${normalizedPath === "/" ? "" : normalizedPath}`
}

export function bookUrl(bookId: string) {
  return absoluteUrl(`/books/${bookId}`)
}

export function columnUrl(postId: string) {
  return absoluteUrl(`/column/${postId}`)
}

export function splitAuthors(author: string) {
  return author
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
}

export function truncateDescription(text: string, maxLength = 155) {
  const normalized = text.replace(/\s+/g, " ").trim()
  if (normalized.length <= maxLength) return normalized

  return `${normalized.slice(0, maxLength - 3).trim()}...`
}

export function parseBookPrice(price: string) {
  return {
    price: price.replace(/[^0-9.]/g, ""),
    priceCurrency: price.includes("$") ? "USD" : "KRW",
  }
}

export function bookPublishedDate(book: Pick<Book, "publishDate">) {
  const year = book.publishDate.match(/\d{4}/)?.[0]
  return year ? `${year}-01-01` : SITE_UPDATED_AT
}
