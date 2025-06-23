"use client"

import { forwardRef, useState } from "react"
import { BooksCatalogModal, BOOKS_DATA } from "./books-catalog-modal"
import { BookModal } from "./book-modal"

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

export const HeroSection = forwardRef<HTMLElement>((props, ref) => {
  const [isCatalogOpen, setIsCatalogOpen] = useState(false)
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [isBookModalOpen, setIsBookModalOpen] = useState(false)

  const handleBookSelect = (book: Book) => {
    setIsCatalogOpen(false)
    setSelectedBook(book)
    setIsBookModalOpen(true)
  }

  return (
    <>
      <section ref={ref} className="min-h-screen flex items-center justify-center px-8 lg:px-16 relative">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="font-playfair text-6xl lg:text-8xl font-light mb-8 leading-tight">
            여행의
            <br />
            <span className="text-accent-orange">순간들을</span>
            <br />
            나누다
          </h1>
          
          <p className="text-xl lg:text-2xl text-text-gray mb-12 font-light leading-relaxed max-w-3xl mx-auto">
            출판브랜드 <span className="text-accent-orange">생각을나누다</span>는 우리의 가치 있는 경험과 생각을 담습니다.
            <br />
            우리의 이야기가 누군가에게 영감의 씨앗이 됩니다.
          </p>

          {/* SEO를 위한 숨겨진 텍스트 */}
          <div className="sr-only">
            <h2>출간 도서 목록</h2>
            <ul>
              <li>길에서 만나다 - 남미 여행 에세이 by 이상민</li>
              <li>자라고 싶은 아이, 아이이고 싶은 어른 - 아빠와 아들의 올레길 여행 by 이상민</li>
              <li>한 걸음에 모든 행복이 담겨있다 - 가족과 함께한 세계여행 by 이상민, 정예원</li>
              <li>안나푸르나에서 보내는 편지 - 히말라야에서 아이들에게 by 이상민</li>
              <li>Meet On The Road - A Journey through South America by Sangmin Lee</li>
            </ul>
          </div>

          <button
            onClick={() => setIsCatalogOpen(true)}
            className="inline-flex items-center gap-3 px-8 py-4 border-2 border-accent-orange text-accent-orange font-medium text-lg hover:bg-accent-orange hover:text-white transition-all duration-300 cursor-pointer"
          >
            여행서 탐험하기
            <span>→</span>
          </button>
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-20 right-20 w-2 h-2 bg-accent-orange rounded-full opacity-60" />
        <div className="absolute bottom-32 left-32 w-1 h-1 bg-accent-orange rounded-full opacity-40" />
        <div className="absolute top-1/2 right-1/4 w-1.5 h-1.5 bg-accent-orange rounded-full opacity-50" />
      </section>

      {/* Modals */}
      <BooksCatalogModal isOpen={isCatalogOpen} onClose={() => setIsCatalogOpen(false)} onBookSelect={handleBookSelect} />
      {selectedBook && (
        <BookModal book={selectedBook} isOpen={isBookModalOpen} onClose={() => setIsBookModalOpen(false)} />
      )}
    </>
  )
})

HeroSection.displayName = "HeroSection"
