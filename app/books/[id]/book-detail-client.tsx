"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { BOOKS_DATA, type Book } from "@/lib/books-data"

interface BookDetailClientProps {
  book: Book
}

export default function BookDetailClient({ book }: BookDetailClientProps) {
  const [selectedImage, setSelectedImage] = useState<number | null>(null)

  // 페이지 로드 시 맨 위로 스크롤
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [book.id])

  // 이미지 모달 관련 키보드 이벤트
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedImage !== null && book) {
        const totalImages = book.id === "gil-eseo-mannada" ? 24 : book.id === "han-geoleum" ? 30 : book.id === "jarago-sipeun-ai" ? 20 : book.id === "annapurna-letter" ? 30 : 0
        
        if (e.key === 'Escape') {
          setSelectedImage(null)
        } else if (e.key === 'ArrowLeft' && selectedImage > 1) {
          setSelectedImage(selectedImage - 1)
        } else if (e.key === 'ArrowRight' && selectedImage < totalImages) {
          setSelectedImage(selectedImage + 1)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedImage, book])

  // 모달이 열릴 때 스크롤 방지
  useEffect(() => {
    if (selectedImage !== null) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [selectedImage])

  return (
    <>
      {/* Book Detail */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Book Cover */}
          <div className="space-y-8">
            <div className="aspect-[3/4] rounded-lg overflow-hidden shadow-2xl max-w-md mx-auto relative">
              <Image 
                src={book.image || "/placeholder.svg"} 
                alt={`${book.title} 표지`} 
                fill
                priority
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>

            {/* Purchase Section */}
            <div className="space-y-4 max-w-md mx-auto">
              {/* Primary Purchase Button */}
              {book.naverLink ? (
                <a
                  href={book.naverLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full bg-accent-orange text-white py-4 px-6 rounded-lg font-medium text-lg hover:bg-accent-orange/90 transition-colors text-center cursor-pointer"
                >
                  {book.price} - 네이버쇼핑에서 구매
                </a>
              ) : book.amazonLink ? (
                <a
                  href={book.amazonLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full bg-accent-orange text-white py-4 px-6 rounded-lg font-medium text-lg hover:bg-accent-orange/90 transition-colors text-center cursor-pointer"
                >
                  {book.price} - Amazon에서 구매
                </a>
              ) : (
                <button className="w-full bg-gray-600 text-white py-4 px-6 rounded-lg font-medium text-lg cursor-not-allowed opacity-50">
                  {book.price} - 준비 중
                </button>
              )}
              
              {/* Secondary Purchase Options */}
              {book.naverLink && book.amazonLink && (
                <a
                  href={book.amazonLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full border-2 border-accent-orange text-accent-orange py-4 px-6 rounded-lg font-medium text-lg hover:bg-accent-orange hover:text-white transition-colors text-center cursor-pointer"
                >
                  Amazon에서도 구매 가능
                </a>
              )}

              {/* Preview Button */}
              {(book.id === "gil-eseo-mannada" || book.id === "han-geoleum" || book.id === "jarago-sipeun-ai" || book.id === "annapurna-letter") && (
                <button
                  onClick={() => setSelectedImage(1)}
                  className="w-full border-2 border-text-gray text-text-gray py-4 px-6 rounded-lg font-medium text-lg hover:bg-text-gray hover:text-primary-dark transition-colors cursor-pointer"
                >
                  미리보기
                </button>
              )}
            </div>
          </div>

          {/* Book Information */}
          <div className="space-y-8">
            <div>
              <h1 className="font-playfair text-4xl lg:text-5xl font-normal mb-4">{book.title}</h1>
              <h2 className="text-xl text-text-gray mb-6">{book.subtitle}</h2>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-text-gray">저자:</span>
                  <span className="ml-2 text-accent-orange">{book.author}</span>
                </div>
                <div>
                  <span className="text-text-gray">페이지:</span>
                  <span className="ml-2 text-text-light">{book.pages}p</span>
                </div>
                <div>
                  <span className="text-text-gray">출간:</span>
                  <span className="ml-2 text-text-light">{book.publishDate}</span>
                </div>
                <div>
                  <span className="text-text-gray">분야:</span>
                  <span className="ml-2 text-text-light">{book.category}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-2xl font-semibold mb-4">책 소개</h3>
              <p className="text-text-gray leading-relaxed text-lg">{book.description}</p>
            </div>

            <div>
              <h3 className="text-2xl font-semibold mb-4">미리보기</h3>
              <blockquote className="border-l-4 border-accent-orange pl-6 italic text-text-gray text-lg leading-relaxed mb-6">
                "{book.excerpt}"
              </blockquote>
            </div>

            {/* Table of Contents */}
            {book.tableOfContents && (
              <div>
                <h3 className="text-2xl font-semibold mb-4">목차</h3>
                <ul className="space-y-2 text-text-gray">
                  {book.tableOfContents.map((chapter, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-accent-orange font-mono text-sm mt-1">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span>{chapter.title}</span>
                      {chapter.page && (
                        <span className="ml-auto text-sm text-text-gray/60">
                          {chapter.page}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Related Books */}
        <div className="mt-16 pt-16 border-t border-text-gray/20">
          <h3 className="text-3xl font-playfair font-normal mb-8">다른 여행서</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {BOOKS_DATA.filter((b) => b.id !== book.id)
              .slice(0, 3)
              .map((relatedBook) => (
                <Link key={relatedBook.id} href={`/books/${relatedBook.id}`} className="group cursor-pointer">
                  <div className="aspect-[3/4] rounded-lg overflow-hidden mb-4 relative">
                    <Image
                      src={relatedBook.image || "/placeholder.svg"}
                      alt={`${relatedBook.title} 표지`}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                  </div>
                  <h4 className="font-semibold mb-2 group-hover:text-accent-orange transition-colors">
                    {relatedBook.title}
                  </h4>
                  <p className="text-text-gray text-sm mb-2">{relatedBook.subtitle}</p>
                  <p className="text-accent-orange font-semibold">{relatedBook.price}</p>
                </Link>
              ))}
          </div>
        </div>
      </div>

      {/* Image Modal */}
      {selectedImage !== null && book && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/90 backdrop-blur-sm" 
            onClick={() => setSelectedImage(null)} 
          />

          {/* Modal Content */}
          <div className="relative max-w-4xl max-h-[90vh] mx-4">
            {/* Close Button */}
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-12 right-0 w-10 h-10 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors z-10 cursor-pointer"
            >
              ✕
            </button>

            {(() => {
              const totalImages = book.id === "gil-eseo-mannada" ? 24 : book.id === "han-geoleum" ? 30 : book.id === "jarago-sipeun-ai" ? 20 : book.id === "annapurna-letter" ? 30 : 0
              const getImageSrc = () => {
                if (book.id === "gil-eseo-mannada") {
                  return `/book_preview/meet_on_the_road/Slide${selectedImage}.jpeg`
                } else if (book.id === "han-geoleum") {
                  return `/book_preview/hangeolum/가족여행기_한걸음에모든행복이담겨있다 미리보기  (${selectedImage}).jpg`
                } else if (book.id === "jarago-sipeun-ai") {
                  return `/book_preview/jarago/자라고싶은아이 아이고싶은어른_올레길여행 미리보기_페이지_${selectedImage.toString().padStart(2, '0')}.jpg`
                } else if (book.id === "annapurna-letter") {
                  return `/book_preview/annapurna/images/page_${selectedImage.toString().padStart(2, '0')}.jpg`
                }
                return ""
              }

              return (
                <>
                  {/* Navigation Buttons */}
                  {selectedImage > 1 && (
                    <button
                      onClick={() => setSelectedImage(selectedImage - 1)}
                      className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors z-10 cursor-pointer"
                    >
                      ←
                    </button>
                  )}
                  {selectedImage < totalImages && (
                    <button
                      onClick={() => setSelectedImage(selectedImage + 1)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors z-10 cursor-pointer"
                    >
                      →
                    </button>
                  )}

                  {/* Image */}
                  <div className="relative max-w-4xl max-h-[90vh]">
                    <Image
                      src={getImageSrc()}
                      alt={`${book.title} 미리보기 ${selectedImage}페이지`}
                      width={800}
                      height={600}
                      className="object-contain rounded-lg shadow-2xl"
                      sizes="(max-width: 768px) 100vw, 800px"
                    />
                    
                    {/* Page Counter */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded-full text-sm">
                      {selectedImage} / {totalImages}
                    </div>
                  </div>
                </>
              )
            })()}

            {/* Instructions */}
            <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-white/70 text-sm text-center">
              <p>← → 키로 이동 | ESC로 닫기</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
} 