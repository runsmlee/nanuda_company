import { BOOKS_DATA, type Book } from "./books-data"
import { BLOG_POSTS, type BlogPost } from "./blog-data"

export interface Author {
  slug: string
  /** 대표 표기 이름 (국문) */
  name: string
  /** 도서/칼럼 author 필드에 등장하는 모든 표기 (동일 인물 식별용) */
  nameVariants: string[]
  jobTitle: string
  bio: string
}

export const AUTHORS: Author[] = [
  {
    slug: "sangmin-lee",
    name: "이상민",
    nameVariants: ["이상민", "Sangmin Lee"],
    jobTitle: "여행 에세이 작가",
    bio:
      "이상민은 생각을나누다(나누다컴퍼니)의 공동 창업자이자 여행 에세이 작가입니다. 대학 시절 떠난 남미 배낭여행을 시작으로, 가족과 함께한 세계여행, 아들과의 제주 올레길, 홀로 걸은 히말라야 안나푸르나 트레킹까지 길 위에서 마주한 순간들을 글로 기록해 왔습니다. 대표작으로 『길에서 만나다』, 『자라고 싶은 아이 아이이고 싶은 어른』, 『한 걸음에 모든 행복이 담겨있다』, 『안나푸르나에서 보내는 편지』가 있으며, 남미 여행기는 영문판 『Meet On The Road』로도 출간되었습니다.",
  },
  {
    slug: "yewon-jung",
    name: "정예원",
    nameVariants: ["정예원"],
    jobTitle: "여행 에세이 작가",
    bio:
      "정예원은 생각을나누다(나누다컴퍼니)의 공동 창업자입니다. 남편, 두 아이와 함께 떠난 세계여행의 순간들을 함께 기록해 여행 에세이 『한 걸음에 모든 행복이 담겨있다』를 공저했습니다.",
  },
]

function authorNamesOf(value: string): string[] {
  return value
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
}

export function getAuthorBySlug(slug: string): Author | undefined {
  return AUTHORS.find((author) => author.slug === slug)
}

export function getAuthorByName(name: string): Author | undefined {
  const normalized = name.trim()
  return AUTHORS.find((author) => author.nameVariants.includes(normalized))
}

/** 도서/칼럼의 author 필드 → 저자 페이지 slug (없으면 undefined) */
export function authorSlugForName(name: string): string | undefined {
  return getAuthorByName(name)?.slug
}

export function getAuthorBooks(author: Author): Book[] {
  return BOOKS_DATA.filter((book) =>
    authorNamesOf(book.author).some((name) => author.nameVariants.includes(name))
  )
}

export function getAuthorColumns(author: Author): BlogPost[] {
  return BLOG_POSTS.filter((post) => author.nameVariants.includes(post.author.trim()))
}
