"use client"

import { useEffect, useState, useCallback } from "react"
import Image from "next/image"
import Link from "next/link"
import { BOOKS_DATA, type Book } from "@/lib/books-data"
import { BookPreviewModal } from "@/components/book-preview-modal"
import { hasPreview } from "@/lib/book-preview-utils"

interface BookDetailClientProps {
  book: Book
}

export default function BookDetailClient({ book }: BookDetailClientProps) {
  const [selectedImage, setSelectedImage] = useState<number | null>(null)

  // 페이지 로드 시 맨 위로 스크롤
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [book.id])

  // 미리보기 네비게이션 핸들러
  const handlePreviewNavigate = useCallback((direction: 'prev' | 'next') => {
    setSelectedImage(prev => {
      if (prev === null) return null
      if (direction === 'prev' && prev > 1) {
        return prev - 1
      }
      if (direction === 'next') {
        // getTotalImages를 직접 호출하는 대신 컴포넌트 내부에서 처리
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
  }, [book.id])

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
              {hasPreview(book.id) && (
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

      {/* Book Preview Modal */}
      <BookPreviewModal
        bookId={book.id}
        bookTitle={book.title}
        selectedImage={selectedImage}
        onClose={() => setSelectedImage(null)}
        onNavigate={handlePreviewNavigate}
        enableZoom={true}
      />
    </>
  )
} 