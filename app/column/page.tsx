"use client"

import { useState } from "react"
import Link from "next/link"
import { CustomCursor } from "@/components/custom-cursor"
import { BLOG_POSTS } from "@/components/blog-section"

export default function ColumnListPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("전체")
  const [searchTerm, setSearchTerm] = useState("")

  const categories = ["전체", "책 이야기", "글쓰기", "육아 & 여행", "여행 철학", "독서"]

  const filteredPosts = BLOG_POSTS.filter((post) => {
    const matchesCategory = selectedCategory === "전체" || post.category === selectedCategory
    const matchesSearch =
      post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.excerpt.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.tags.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    return matchesCategory && matchesSearch
  })

  return (
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
            여행에서 얻은 깨달음, 책을 쓰며 느낀 감정, 일상에서 마주한 특별한 순간들까지. 나누다컴퍼니가 전하고 싶은
            모든 이야기들을 만나보세요.
          </p>
        </div>

        {/* Filters */}
        <div className="mb-12 space-y-6">
          {/* Search */}
          <div className="max-w-md mx-auto">
            <input
              type="text"
              placeholder="제목, 내용, 태그로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-6 py-3 bg-secondary-dark border border-text-gray/30 rounded-lg text-text-light placeholder-text-gray focus:border-accent-orange focus:outline-none"
            />
          </div>

          {/* Categories */}
          <div className="flex justify-center gap-3 flex-wrap">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-6 py-2 rounded-full transition-all duration-300 cursor-pointer ${
                  selectedCategory === category
                    ? "bg-accent-orange text-white"
                    : "bg-secondary-dark text-text-gray hover:bg-text-gray/20 hover:text-text-light"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Posts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredPosts.map((post) => (
            <Link key={post.id} href={`/column/${post.id}`} className="group cursor-pointer">
              <article className="bg-secondary-dark rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300">
                <div className="aspect-[4/3] overflow-hidden relative">
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

                <div className="p-6 space-y-4">
                  <h2 className="text-xl font-semibold leading-tight group-hover:text-accent-orange transition-colors">
                    {post.title}
                  </h2>
                  <p className="text-text-gray leading-relaxed">{post.excerpt}</p>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-text-gray text-sm">by {post.author}</span>
                    <div className="flex gap-2">
                      {post.tags.slice(0, 3).map((tag) => (
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

        {filteredPosts.length === 0 && (
          <div className="text-center py-16">
            <p className="text-text-gray text-xl">검색 결과가 없습니다.</p>
            <p className="text-text-gray mt-2">다른 키워드로 검색해보세요.</p>
          </div>
        )}
      </div>
    </div>
  )
}
