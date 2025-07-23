"use client"

import { useEffect } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"

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

interface BookModalProps {
  book: Book | null
  isOpen: boolean
  onClose: () => void
}

export function BookModal({ book, isOpen, onClose }: BookModalProps) {
  const router = useRouter()

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }

    return () => {
      document.body.style.overflow = "unset"
    }
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape)
    }

    return () => document.removeEventListener("keydown", handleEscape)
  }, [isOpen, onClose])

  const handleDetailPageClick = () => {
    if (book) {
      onClose()
      router.push(`/books/${book.id}`)
    }
  }

  if (!isOpen || !book) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-pointer" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-secondary-dark rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors cursor-pointer"
        >
          ✕
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-8">
          {/* Book Cover */}
          <div className="space-y-6">
            <div className="aspect-[3/4] rounded-lg overflow-hidden shadow-2xl relative">
              <Image 
                src={book.image || "/placeholder.svg"} 
                alt={book.title} 
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>

            {/* Purchase Buttons */}
            <div className="space-y-3">
              {/* Primary Purchase Button */}
              {book.naverLink ? (
                <a
                  href={book.naverLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full bg-accent-orange text-white py-3 px-6 rounded-lg font-medium hover:bg-accent-orange/90 transition-colors text-center cursor-pointer"
                >
                  {book.price} - 네이버쇼핑에서 구매
                </a>
              ) : book.amazonLink ? (
                <a
                  href={book.amazonLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full bg-accent-orange text-white py-3 px-6 rounded-lg font-medium hover:bg-accent-orange/90 transition-colors text-center cursor-pointer"
                >
                  {book.price} - Amazon에서 구매
                </a>
              ) : (
                <button className="w-full bg-gray-600 text-white py-3 px-6 rounded-lg font-medium cursor-not-allowed opacity-50">
                  {book.price} - 준비 중
                </button>
              )}
              
              {/* Secondary Purchase Options */}
              {book.naverLink && book.amazonLink && (
                <a
                  href={book.amazonLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full border border-accent-orange text-accent-orange py-3 px-6 rounded-lg font-medium hover:bg-accent-orange hover:text-white transition-colors text-center cursor-pointer"
                >
                  Amazon에서도 구매 가능
                </a>
              )}
            </div>
          </div>

          {/* Book Details */}
          <div className="space-y-6">
            <div>
              <h2 className="font-playfair text-3xl font-normal mb-2 text-text-light">{book.title}</h2>
              <p className="text-text-gray text-lg mb-4">{book.subtitle}</p>
              <div className="flex flex-wrap gap-4 text-sm text-accent-orange">
                <span>저자: {book.author}</span>
                <span>페이지: {book.pages}p</span>
                <span>출간: {book.publishDate}</span>
                <span>분야: {book.category}</span>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-3 text-text-light">책 소개</h3>
              <p className="text-text-gray leading-relaxed">{book.description}</p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-3 text-text-light">미리보기</h3>
              <p className="text-text-gray leading-relaxed italic">"{book.excerpt}"</p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-4">
              <button
                onClick={handleDetailPageClick}
                className="flex-1 bg-accent-blue text-white py-3 px-6 rounded-lg font-medium hover:bg-accent-blue/90 transition-colors text-center cursor-pointer"
              >
                상세 페이지 보기
              </button>
              <button
                onClick={onClose}
                className="px-6 py-3 border border-text-gray text-text-gray rounded-lg hover:bg-text-gray hover:text-primary-dark transition-colors cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
