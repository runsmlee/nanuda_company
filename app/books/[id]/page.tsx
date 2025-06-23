"use client"

import { useParams } from "next/navigation"
import { useEffect } from "react"
import { BOOKS_DATA } from "@/components/books-catalog-modal"
import { CustomCursor } from "@/components/custom-cursor"
import Link from "next/link"

export default function BookDetailPage() {
  const params = useParams()
  const book = BOOKS_DATA.find((b) => b.id === params.id)

  // 페이지 로드 시 맨 위로 스크롤
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [params.id])

  if (!book) {
    return (
      <div className="min-h-screen bg-primary-dark text-text-light flex items-center justify-center">
        <CustomCursor />
        <div className="text-center">
          <h1 className="text-4xl font-playfair mb-4">책을 찾을 수 없습니다</h1>
          <Link href="/" className="text-accent-orange hover:underline cursor-pointer">
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-primary-dark text-text-light">
      <CustomCursor />

      {/* Navigation */}
      <nav className="p-6 border-b border-text-gray/20">
        <Link href="/" className="text-accent-orange hover:underline cursor-pointer">
          ← 홈으로 돌아가기
        </Link>
      </nav>

      {/* Book Detail */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Book Cover */}
          <div className="space-y-8">
            <div className="aspect-[3/4] rounded-lg overflow-hidden shadow-2xl max-w-md mx-auto">
              <img src={book.image || "/placeholder.svg"} alt={book.title} className="w-full h-full object-cover" />
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
              
              <button className="w-full border border-text-gray text-text-gray py-3 px-6 rounded-lg hover:bg-text-gray hover:text-primary-dark transition-colors cursor-pointer">
                미리보기
              </button>
            </div>
          </div>

          {/* Book Information */}
          <div className="space-y-8">
            <div>
              <h1 className="font-playfair text-4xl lg:text-5xl font-normal mb-4">{book.title}</h1>
              <p className="text-xl text-text-gray mb-6">{book.subtitle}</p>

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
              <h2 className="text-2xl font-semibold mb-4">책 소개</h2>
              <p className="text-text-gray leading-relaxed text-lg">{book.description}</p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-4">미리보기</h2>
              <blockquote className="border-l-4 border-accent-orange pl-6 italic text-text-gray text-lg leading-relaxed">
                "{book.excerpt}"
              </blockquote>
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-4">목차</h2>
              <div className="space-y-2 text-text-gray">
                <div className="flex justify-between py-2 border-b border-text-gray/20 cursor-pointer hover:text-accent-orange transition-colors">
                  <span>프롤로그</span>
                  <span>5</span>
                </div>
                <div className="flex justify-between py-2 border-b border-text-gray/20 cursor-pointer hover:text-accent-orange transition-colors">
                  <span>1장. 여행의 시작</span>
                  <span>23</span>
                </div>
                <div className="flex justify-between py-2 border-b border-text-gray/20 cursor-pointer hover:text-accent-orange transition-colors">
                  <span>2장. 길 위에서 만난 사람들</span>
                  <span>67</span>
                </div>
                <div className="flex justify-between py-2 border-b border-text-gray/20 cursor-pointer hover:text-accent-orange transition-colors">
                  <span>3장. 예상치 못한 순간들</span>
                  <span>134</span>
                </div>
                <div className="flex justify-between py-2 border-b border-text-gray/20 cursor-pointer hover:text-accent-orange transition-colors">
                  <span>에필로그</span>
                  <span>201</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Related Books */}
        <div className="mt-16 pt-16 border-t border-text-gray/20">
          <h2 className="text-3xl font-playfair font-normal mb-8">다른 여행서</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {BOOKS_DATA.filter((b) => b.id !== book.id)
              .slice(0, 3)
              .map((relatedBook) => (
                <Link key={relatedBook.id} href={`/books/${relatedBook.id}`} className="group cursor-pointer">
                  <div className="aspect-[3/4] rounded-lg overflow-hidden mb-4">
                    <img
                      src={relatedBook.image || "/placeholder.svg"}
                      alt={relatedBook.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <h3 className="font-semibold mb-2 group-hover:text-accent-orange transition-colors">
                    {relatedBook.title}
                  </h3>
                  <p className="text-text-gray text-sm mb-2">{relatedBook.subtitle}</p>
                  <p className="text-accent-orange font-semibold">{relatedBook.price}</p>
                </Link>
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}
