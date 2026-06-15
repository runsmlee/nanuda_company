"use client"

import { useEffect, useState, useCallback } from "react"
import Image from "next/image"
import Link from "next/link"
import { BookOpen, Images, Share2, ShoppingBag } from "lucide-react"
import { BOOKS_DATA, type Book } from "@/lib/books-data"
import { BookPreviewModal } from "@/components/book-preview-modal"
import { hasPreview } from "@/lib/book-preview-utils"
import { getOnlineReaderMeta } from "@/lib/book-reader-config"

interface BookDetailClientProps {
  book: Book
}

export default function BookDetailClient({ book }: BookDetailClientProps) {
  const [selectedImage, setSelectedImage] = useState<number | null>(null)
  const [shareCopied, setShareCopied] = useState(false)
  const readerMeta = getOnlineReaderMeta(book.id)
  const purchaseHref = book.naverLink || book.amazonLink
  const purchaseLabel = book.naverLink
    ? `종이책 구매하기 · ${book.price}`
    : book.amazonLink
      ? `Amazon에서 구매하기 · ${book.price}`
      : null

  // 페이지 로드 시 맨 위로 스크롤
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [book.id])

  // 공유 — 네이티브 공유 시트, 없으면 링크 복사로 폴백
  const handleShare = async () => {
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title: book.title, text: `${book.title} — ${book.subtitle}`, url })
      } else {
        await navigator.clipboard.writeText(url)
        setShareCopied(true)
        setTimeout(() => setShareCopied(false), 2000)
      }
    } catch {
      // 공유 시트를 닫았거나 클립보드 접근이 막힌 경우 — 조용히 무시
    }
  }

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
          {/* Book Cover — first on mobile (the "open the cover" moment), left on desktop */}
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

            <div className="border-y border-text-gray/20 py-6">
              {readerMeta && (
                <div className="mb-5">
                  <p className="text-sm font-medium text-accent-orange">
                    무료 공개본
                  </p>
                  <p className="mt-2 text-text-gray leading-relaxed">
                    책의 전반부를 온라인에서 무료로 읽어볼 수 있어요. {readerMeta.summary} · 나머지 이야기는 종이책에 담겨 있습니다.
                  </p>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                {readerMeta && (
                  <Link
                    href={`/books/${book.id}/read`}
                    className="inline-flex items-center justify-center gap-2 bg-text-light text-primary-dark px-5 py-3 font-medium hover:bg-text-light/90 transition-colors text-center cursor-pointer"
                  >
                    <BookOpen className="h-4 w-4" />
                    {readerMeta.label}
                  </Link>
                )}

                {purchaseHref && purchaseLabel ? (
                  <a
                    href={purchaseHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={
                      readerMeta
                        ? "inline-flex items-center justify-center gap-2 border border-accent-orange px-5 py-3 font-medium text-accent-orange transition-colors hover:bg-accent-orange hover:text-white text-center cursor-pointer"
                        : "inline-flex items-center justify-center gap-2 bg-accent-orange px-5 py-3 font-medium text-white transition-colors hover:bg-accent-orange/90 text-center cursor-pointer"
                    }
                  >
                    <ShoppingBag className="h-4 w-4" />
                    {purchaseLabel}
                  </a>
                ) : (
                  <button className="inline-flex items-center justify-center bg-gray-600 px-5 py-3 font-medium text-white opacity-50 cursor-not-allowed">
                    {book.price} · 준비 중
                  </button>
                )}

                {book.naverLink && book.amazonLink && (
                  <a
                    href={book.amazonLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 border border-text-gray/50 px-5 py-3 font-medium text-text-gray transition-colors hover:bg-text-gray hover:text-primary-dark text-center cursor-pointer"
                  >
                    <ShoppingBag className="h-4 w-4" />
                    Amazon 구매
                  </a>
                )}

                {hasPreview(book.id) && (
                  <button
                    onClick={() => setSelectedImage(1)}
                    title="책의 실제 지면을 이미지로 미리 봅니다"
                    className="inline-flex items-center justify-center gap-2 border border-text-gray/50 px-5 py-3 font-medium text-text-gray transition-colors hover:bg-text-gray hover:text-primary-dark cursor-pointer"
                  >
                    <Images className="h-4 w-4" />
                    책 속지 보기
                  </button>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-2xl font-semibold mb-4">책 소개</h3>
              <p className="text-text-gray leading-relaxed text-lg">{book.description}</p>
            </div>

            <div>
              <h3 className="text-2xl font-semibold mb-4">책 속 문장</h3>
              <blockquote className="border-y border-text-gray/20 py-6 italic text-text-gray text-lg leading-relaxed mb-6">
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

            {/* Share — fulfils the "나누다(나눔)" promise, kept quiet */}
            <div className="flex items-center gap-5 border-t border-text-gray/20 pt-6 text-sm text-text-gray">
              <button
                onClick={handleShare}
                className="inline-flex items-center gap-2 transition-colors hover:text-accent-orange cursor-pointer"
              >
                <Share2 className="h-4 w-4" />
                {shareCopied ? "링크가 복사되었어요" : "공유하기"}
              </button>
            </div>
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
