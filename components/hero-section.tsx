"use client"

import { forwardRef, useEffect, useRef, useState } from "react"
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
  const cardsRef = useRef<HTMLDivElement[]>([])
  const [isCatalogOpen, setIsCatalogOpen] = useState(false)
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [isBookModalOpen, setIsBookModalOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.pageYOffset
      cardsRef.current.forEach((card, index) => {
        if (card) {
          const speed = 0.5 + index * 0.2
          card.style.transform = `translateY(${scrolled * speed}px) rotate(${-15 + index * 5}deg)`
        }
      })
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const handleBookCardClick = (bookId: string) => {
    const book = BOOKS_DATA.find((b) => b.id === bookId)
    if (book) {
      setSelectedBook(book)
      setIsBookModalOpen(true)
    }
  }

  const handleBookSelect = (book: Book) => {
    setIsCatalogOpen(false)
    setSelectedBook(book)
    setIsBookModalOpen(true)
  }

  const floatingBooks = [
    {
      id: "annapurna-letter",
      title: "안나푸르나에서 보내는 편지",
      subtitle: "히말라야에서 아이들에게",
      image: "/images/annapurna-letter.jpg",
    },
    {
      id: "gil-eseo-mannada",
      title: "길에서 만나다",
      subtitle: "남미의 기록",
      image: "/images/gil-eseo-mannada.jpg",
    },
    {
      id: "jarago-sipeun-ai",
      title: "자라고 싶은 아이, 아이이고 싶은 어른",
      subtitle: "아빠와 아들의 올레길 여행",
      image: "/images/jarago-sipeun-ai.jpg",
    },
  ]

  return (
    <>
      <section
        ref={ref}
        className="h-screen relative flex items-center bg-gradient-to-br from-primary-dark to-secondary-dark overflow-hidden"
      >
        {/* Noise texture overlay */}
        <div className="absolute inset-0 opacity-10 bg-noise" />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-16 w-full px-8 lg:px-16 items-center relative z-10">
          <div className="space-y-8">
            <h1 className="font-playfair font-light text-6xl lg:text-8xl leading-none">
              여행의
              <span className="block text-accent-orange italic transform -rotate-1 ml-8 font-playfair">순간들을</span>
              나누다
            </h1>

            <p className="text-xl text-text-gray font-light leading-relaxed max-w-md">
              &quot;생각을나누다&quot;는 우리의 여행길 위에서 마주한 특별한 순간의 생각과 이야기를 책으로 담아 전합니다.
            </p>

            <button
              onClick={() => setIsCatalogOpen(true)}
              className="inline-flex items-center gap-4 px-12 py-6 border-2 border-accent-orange text-accent-orange font-medium transition-all duration-400 relative overflow-hidden group hover:text-primary-dark cursor-pointer"
            >
              <span className="absolute inset-0 bg-accent-orange transform -translate-x-full group-hover:translate-x-0 transition-transform duration-400" />
              <span className="relative">여행서 탐험하기</span>
              <span className="relative">→</span>
            </button>
          </div>

          <div className="relative h-96 hidden lg:block">
            {floatingBooks.map((card, index) => (
              <div
                key={index}
                ref={(el) => {
                  if (el) cardsRef.current[index] = el
                }}
                onClick={() => handleBookCardClick(card.id)}
                className={`absolute w-48 h-64 bg-white rounded-lg shadow-2xl overflow-hidden transition-transform duration-300 hover:scale-105 cursor-pointer ${
                  index === 0
                    ? "top-8 left-8 lg:left-4 xl:left-0 -rotate-12 z-30"
                    : index === 1
                      ? "top-16 right-12 lg:right-8 xl:right-4 rotate-8 z-20"
                      : "top-32 right-20 lg:right-16 xl:right-12 -rotate-6 z-10"
                }`}
              >
                <div className="h-full w-full relative">
                  <img src={card.image || "/placeholder.svg"} alt={card.title} className="w-full h-full object-cover" />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                    <h4 className="text-white text-xs font-semibold mb-1">{card.title}</h4>
                    <p className="text-white/80 text-xs">{card.subtitle}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modals */}
      <BooksCatalogModal
        isOpen={isCatalogOpen}
        onClose={() => setIsCatalogOpen(false)}
        onBookSelect={handleBookSelect}
      />

      <BookModal book={selectedBook} isOpen={isBookModalOpen} onClose={() => setIsBookModalOpen(false)} />
    </>
  )
})

HeroSection.displayName = "HeroSection"
