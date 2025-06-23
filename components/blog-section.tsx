"use client"

import { forwardRef } from "react"
import Link from "next/link"

interface BlogPost {
  id: string
  title: string
  excerpt: string
  date: string
  category: string
  readTime: string
  image: string
  author: string
  tags: string[]
}

const BLOG_POSTS: BlogPost[] = [
  {
    id: "annapurna-behind-story",
    title: "안나푸르나에서 보내는 편지, 그 뒷이야기",
    excerpt: "히말라야 트레킹 중 마주한 예상치 못한 순간들과 책에 담지 못한 에피소드들을 공유합니다.",
    date: "2025.01.15",
    category: "책 이야기",
    readTime: "5분",
    image: "/images/annapurna-letter.jpg",
    author: "이상민",
    tags: ["히말라야", "트레킹", "여행에세이", "안나푸르나"],
  },
  {
    id: "travel-writing-tips",
    title: "여행을 글로 남기는 법",
    excerpt: "그동안의 여행 글쓰기 경험을 바탕으로 기억에 남는 여행기를 쓰는 실용적인 팁들을 나눕니다.",
    date: "2025.01.10",
    category: "글쓰기",
    readTime: "7분",
    image: "/images/gil-eseo-mannada.jpg",
    author: "이상민",
    tags: ["글쓰기", "여행기", "에세이", "창작"],
  },
  {
    id: "family-travel-philosophy",
    title: "아이와 함께하는 여행의 철학",
    excerpt: "여행이 단순한 휴가를 넘어 아이의 성장과 가족 관계에 미치는 깊은 영향에 대한 생각을 나눕니다.",
    date: "2025.01.05",
    category: "육아 & 여행",
    readTime: "6분",
    image: "/images/jarago-sipeun-ai.jpg",
    author: "이상민",
    tags: ["가족여행", "육아", "성장", "교육"],
  },
]

export const BlogSection = forwardRef<HTMLElement>((props, ref) => {
  return (
    <section ref={ref} className="py-32 px-8 lg:px-16 bg-secondary-dark relative">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-24">
          <h2 className="font-playfair text-6xl font-light mb-4 relative inline-block">
            글을 나누다
            <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-24 h-0.5 bg-accent-orange" />
            <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-24 h-0.5 bg-accent-orange" />
          </h2>
          <p className="text-text-gray text-lg mt-8 max-w-2xl mx-auto">
            {"나누다컴퍼니가 미처 책으로 담지 못한 이야기들, 책에 대한 생각들, \n그리고 나누고 싶은 어떤 순간들을 글로 담아 전합니다."}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mb-16">
          {BLOG_POSTS.map((post, index) => (
            <Link key={post.id} href={`/column/${post.id}`} className="group cursor-pointer">
              <article
                className={`relative transition-all duration-400 hover:-translate-y-4 ${
                  index === 1 ? "lg:translate-y-12" : ""
                }`}
              >
                <div className="aspect-[4/3] overflow-hidden rounded-lg mb-6 relative">
                  <img
                    src={post.image || "/placeholder.svg"}
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute top-4 right-4 bg-black/80 px-3 py-1 rounded-full">
                    <span className="text-accent-orange text-sm font-medium">{post.category}</span>
                  </div>
                  <div className="absolute bottom-4 left-4 text-white text-sm">
                    <span>{post.date}</span>
                    <span className="mx-2">•</span>
                    <span>{post.readTime} 읽기</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xl font-semibold leading-tight group-hover:text-accent-orange transition-colors">
                    {post.title}
                  </h3>
                  <p className="text-text-gray leading-relaxed text-sm">{post.excerpt}</p>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-text-gray text-sm">by {post.author}</span>
                    <div className="flex gap-2">
                      {post.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className="text-xs bg-primary-dark px-2 py-1 rounded text-text-gray">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            </Link>
          ))}
        </div>

        {/* View All Button */}
        <div className="text-center">
          <Link
            href="/column"
            className="inline-flex items-center gap-3 px-8 py-4 border-2 border-accent-orange text-accent-orange font-medium hover:bg-accent-orange hover:text-white transition-all duration-300 cursor-pointer"
          >
            모든 칼럼 보기
            <span>→</span>
          </Link>
        </div>
      </div>
    </section>
  )
})

BlogSection.displayName = "BlogSection"

export { BLOG_POSTS }
