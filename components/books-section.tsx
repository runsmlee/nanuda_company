"use client"

import { forwardRef, useEffect, useRef, useState } from "react"
import { BookModal } from "./book-modal"
import { BOOKS_DATA } from "../lib/books-data"

interface Book {
  id: string
  title: string
  subtitle: string
  price: string
  image: string
  description: string
  author: string
  pages: number
  publishDate: string
  category: string
  amazonLink?: string
  excerpt: string
  naverLink?: string
}

export const BooksSection = forwardRef<HTMLElement>((props, ref) => {
  const observerRef = useRef<IntersectionObserver | null>(null)
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [isBookModalOpen, setIsBookModalOpen] = useState(false)

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate-fade-in-up")
          }
        })
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" },
    )

    const elements = document.querySelectorAll(".animate-on-scroll")
    elements.forEach((el) => observerRef.current?.observe(el))

    return () => observerRef.current?.disconnect()
  }, [])

  const handleBookClick = (bookId: string) => {
    const book = BOOKS_DATA.find((b) => b.id === bookId)
    if (book) {
      setSelectedBook(book)
      setIsBookModalOpen(true)
    }
  }

  // BOOKS_DATA에서 사이드바에 표시할 책들을 선택
  const sidebarBooks = [
    BOOKS_DATA.find(book => book.id === "meet-on-the-road"),
    BOOKS_DATA.find(book => book.id === "han-geoleum"),
    BOOKS_DATA.find(book => book.id === "jarago-sipeun-ai"),
    BOOKS_DATA.find(book => book.id === "gil-eseo-mannada"),
  ].filter(Boolean) // undefined 값 제거

  // 안나푸르나 책 정보 가져오기
  const annapurnaBook = BOOKS_DATA.find(book => book.id === "annapurna-letter")

  return (
    <>
      <section ref={ref} className="py-32 px-8 lg:px-16 relative">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 mb-24 items-end">
          <div>
            <div className="font-playfair text-8xl lg:text-9xl font-light text-accent-orange opacity-30 leading-none">
              01
            </div>
          </div>
          <div>
            <h2 className="font-playfair text-5xl font-normal mb-4">책을 나누다 </h2>
            <p className="text-text-gray text-lg leading-relaxed">
              각각의 여행은 독특한 이야기를 담고 있습니다. 우리가 경험한 특별한 순간들을 책으로 만나보세요.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-16">
          <article
            onClick={() => handleBookClick("annapurna-letter")}
            className="lg:col-span-7 bg-secondary-dark overflow-hidden relative transform -skew-y-1 transition-all duration-400 hover:skew-y-0 hover:scale-105 animate-on-scroll opacity-0 translate-y-12 cursor-pointer"
          >
            <div className="h-96 relative overflow-hidden">
              <img
                src="/images/annapurna-letter.jpg"
                alt="안나푸르나에서 보내는 편지"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            </div>
            <div className="p-12 transform skew-y-1">
              <h3 className="font-playfair text-3xl font-normal mb-4 text-text-light">안나푸르나에서 보내는 편지</h3>
              <div className="flex gap-8 mb-6">
                <span className="text-accent-orange font-medium">{annapurnaBook?.price}</span>
                <span className="text-accent-orange font-medium">{annapurnaBook?.publishDate}</span>
                <span className="text-accent-orange font-medium">{annapurnaBook?.category}</span>
              </div>
              <p className="text-text-gray leading-relaxed mb-8">
                5년 만에 다시 여행길에 오른 저자가 포터나 가이드 없이 안나푸르나 지역을 한 달간 트레킹하며 두 아이에게
                전하고 싶었던 이야기. &apos;크레이지 코리안&apos;, &apos;코리안 머신&apos;으로 불리며 자신의 한계를 깨기 위한 노력을
                계속하는 아버지의 진솔한 편지입니다.
              </p>
              <span className="text-accent-orange font-medium relative group cursor-pointer">
                자세히 보기
                <span className="ml-2 transition-all duration-300 group-hover:ml-4">→</span>
              </span>
            </div>
          </article>

          <div className="lg:col-span-5 space-y-8">
            {sidebarBooks.map((book, index) => 
              book ? (
                <article
                  key={index}
                  onClick={() => handleBookClick(book.id)}
                  className="bg-secondary-dark overflow-hidden border-l-4 border-accent-orange transition-all duration-300 hover:translate-x-4 hover:bg-gray-700 cursor-pointer animate-on-scroll opacity-0 translate-y-12 flex h-40"
                  style={{ animationDelay: `${index * 0.2}s` }}
                >
                  <div className="w-32 h-full flex-shrink-0">
                    <img src={book.image || "/placeholder.svg"} alt={book.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-6 flex-1 flex flex-col justify-center">
                    <h4 className="text-lg font-semibold mb-2">{book.title}</h4>
                    <p className="text-text-gray text-sm mb-4 line-clamp-2">{book.subtitle}</p>
                    <div className="text-accent-orange font-semibold text-xl">{book.price}</div>
                  </div>
                </article>
              ) : null
            )}
          </div>
        </div>
      </section>

      <BookModal book={selectedBook} isOpen={isBookModalOpen} onClose={() => setIsBookModalOpen(false)} />
    </>
  )
})

BooksSection.displayName = "BooksSection"
