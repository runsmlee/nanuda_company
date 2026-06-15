"use client"

import { useEffect, useState, useCallback } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { BookOpen, Images, ShoppingBag } from "lucide-react"
import { BookPreviewModal } from "@/components/book-preview-modal"
import { hasPreview } from "@/lib/book-preview-utils"
import { getOnlineReaderMeta } from "@/lib/book-reader-config"

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
  const [selectedImage, setSelectedImage] = useState<number | null>(null)
  const readerMeta = book ? getOnlineReaderMeta(book.id) : null

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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedImage !== null) {
          setSelectedImage(null)
        } else {
          onClose()
        }
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown)
    }

    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose, selectedImage])

  const handleDetailPageClick = () => {
    if (book) {
      onClose()
      router.push(`/books/${book.id}`)
    }
  }

  const handleReaderClick = () => {
    if (book) {
      onClose()
      router.push(`/books/${book.id}/read`)
    }
  }

  // 미리보기 네비게이션 핸들러
  const handlePreviewNavigate = useCallback((direction: 'prev' | 'next') => {
    if (!book) return
    
    setSelectedImage(prev => {
      if (prev === null) return null
      if (direction === 'prev' && prev > 1) {
        return prev - 1
      }
      if (direction === 'next') {
        const totalImages = book.id === "gil-eseo-mannada" ? 24
          : book.id === "han-geoleum" ? 30 
          : book.id === "jarago-sipeun-ai" ? 20
          : book.id === "annapurna-letter" ? 30 
          : 0
        if (prev < totalImages) {
          return prev + 1
        }
      }
      return prev
    })
  }, [book])

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
              {readerMeta && (
                <button
                  onClick={handleReaderClick}
                  className="flex w-full items-center justify-center gap-2 bg-text-light text-primary-dark py-3 px-6 font-medium hover:bg-text-light/90 transition-colors text-center cursor-pointer"
                >
                  <BookOpen className="h-4 w-4" />
                  {readerMeta.label}
                </button>
              )}

              {/* Primary Purchase Button */}
              {book.naverLink ? (
                <a
                  href={book.naverLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 bg-accent-orange text-white py-3 px-6 font-medium hover:bg-accent-orange/90 transition-colors text-center cursor-pointer"
                >
                  <ShoppingBag className="h-4 w-4" />
                  종이책 구매하기 · {book.price}
                </a>
              ) : book.amazonLink ? (
                <a
                  href={book.amazonLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 bg-accent-orange text-white py-3 px-6 font-medium hover:bg-accent-orange/90 transition-colors text-center cursor-pointer"
                >
                  <ShoppingBag className="h-4 w-4" />
                  Amazon에서 구매하기 · {book.price}
                </a>
              ) : (
                <button className="w-full bg-gray-600 text-white py-3 px-6 font-medium cursor-not-allowed opacity-50">
                  {book.price} · 준비 중
                </button>
              )}
              
              {/* Secondary Purchase Options */}
              {book.naverLink && book.amazonLink && (
                <a
                  href={book.amazonLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 border border-accent-orange text-accent-orange py-3 px-6 font-medium hover:bg-accent-orange hover:text-white transition-colors text-center cursor-pointer"
                >
                  <ShoppingBag className="h-4 w-4" />
                  Amazon 구매
                </a>
              )}

              {/* Preview Button */}
              {book && hasPreview(book.id) && (
                <button
                  onClick={() => setSelectedImage(1)}
                  className="flex w-full items-center justify-center gap-2 border border-text-gray text-text-gray py-3 px-6 font-medium hover:bg-text-gray hover:text-primary-dark transition-colors cursor-pointer"
                >
                  <Images className="h-4 w-4" />
                  책 속지 보기
                </button>
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

            {readerMeta && (
              <div className="border-y border-text-gray/20 py-4">
                <p className="text-sm font-medium text-accent-orange">
                  무료 공개본
                </p>
                <p className="mt-2 text-sm leading-6 text-text-gray">
                  전반부를 텍스트로 바로 읽을 수 있습니다. {readerMeta.summary}
                </p>
              </div>
            )}

            <div>
              <h3 className="text-xl font-semibold mb-3 text-text-light">책 소개</h3>
              <p className="text-text-gray leading-relaxed">{book.description}</p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-3 text-text-light">책 속 문장</h3>
              <p className="text-text-gray leading-relaxed italic">"{book.excerpt}"</p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-4">
              <button
                onClick={handleDetailPageClick}
                className="flex-1 bg-accent-blue text-white py-3 px-6 rounded-lg font-medium hover:bg-accent-blue/90 transition-colors text-center cursor-pointer"
              >
                책 상세 보기
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

      {/* Book Preview Modal */}
      <BookPreviewModal
        bookId={book?.id || ""}
        bookTitle={book?.title || ""}
        selectedImage={selectedImage}
        onClose={() => setSelectedImage(null)}
        onNavigate={handlePreviewNavigate}
        enableZoom={false}
      />
    </div>
  )
}
