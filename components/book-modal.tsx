"use client"

import { useEffect, useState, useCallback } from "react"
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
  
  // 미리보기 상태 관리
  const [selectedImage, setSelectedImage] = useState<number | null>(null)
  const [imageLoading, setImageLoading] = useState(false)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)
  
  // 줌/팬 상태 관리
  const [scale, setScale] = useState(1)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [isPanning, setIsPanning] = useState(false)
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 })
  const [isZoomed, setIsZoomed] = useState(false)
  const [touchDistance, setTouchDistance] = useState(0)
  const [initialTouches, setInitialTouches] = useState<React.Touch[]>([])

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

  // 총 이미지 개수 계산 함수
  const getTotalImages = useCallback(() => {
    if (!book) return 0
    switch (book.id) {
      case "gil-eseo-mannada": return 24
      case "han-geoleum": return 30
      case "jarago-sipeun-ai": return 20
      case "annapurna-letter": return 30
      default: return 0
    }
  }, [book])

  // 이미지 경로 생성 함수
  const getImageSrc = useCallback((imageIndex: number) => {
    if (!book) return ""
    switch (book.id) {
      case "gil-eseo-mannada":
        return `/book_preview/meet_on_the_road/Slide${imageIndex}.jpeg`
      case "han-geoleum":
        return `/book_preview/hangeolum/가족여행기_한걸음에모든행복이담겨있다 미리보기  (${imageIndex}).jpg`
      case "jarago-sipeun-ai":
        return `/book_preview/jarago/자라고싶은아이 아이고싶은어른_올레길여행 미리보기_페이지_${imageIndex.toString().padStart(2, '0')}.jpg`
      case "annapurna-letter":
        return `/book_preview/annapurna/images/page_${imageIndex.toString().padStart(2, '0')}.jpg`
      default:
        return ""
    }
  }, [book])

  // 미리보기 가능 여부 확인
  const hasPreview = useCallback(() => {
    if (!book) return false
    return ["gil-eseo-mannada", "han-geoleum", "jarago-sipeun-ai", "annapurna-letter"].includes(book.id)
  }, [book])

  // 줌/팬 리셋 함수
  const resetZoomAndPan = useCallback(() => {
    setScale(1)
    setPanX(0)
    setPanY(0)
    setIsZoomed(false)
  }, [])

  // 네비게이션 함수들
  const goToPreviousImage = useCallback(() => {
    if (selectedImage !== null && selectedImage > 1) {
      setImageLoading(true)
      setSelectedImage(selectedImage - 1)
      resetZoomAndPan()
    }
  }, [selectedImage, resetZoomAndPan])

  const goToNextImage = useCallback(() => {
    const totalImages = getTotalImages()
    if (selectedImage !== null && selectedImage < totalImages) {
      setImageLoading(true)
      setSelectedImage(selectedImage + 1)
      resetZoomAndPan()
    }
  }, [selectedImage, getTotalImages, resetZoomAndPan])

  // 줌 함수들
  const zoomIn = useCallback(() => {
    setScale(prev => Math.min(prev * 1.5, 5))
    setIsZoomed(true)
  }, [])

  const zoomOut = useCallback(() => {
    setScale(prev => {
      const newScale = Math.max(prev / 1.5, 0.5)
      if (newScale <= 1) {
        setPanX(0)
        setPanY(0)
        setIsZoomed(false)
        return 1
      }
      setIsZoomed(true)
      return newScale
    })
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedImage !== null) {
        // 미리보기 모달이 열려있을 때
        if (e.key === "Escape") {
          setSelectedImage(null)
        } else if (e.key === "ArrowLeft") {
          e.preventDefault()
          goToPreviousImage()
        } else if (e.key === "ArrowRight") {
          e.preventDefault()
          goToNextImage()
        }
      } else if (e.key === "Escape") {
        // 일반 모달이 열려있을 때
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown)
    }

    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose, selectedImage, goToPreviousImage, goToNextImage])

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

              {/* Preview Button */}
              {hasPreview() && (
                <button
                  onClick={() => setSelectedImage(1)}
                  className="w-full border-2 border-text-gray text-text-gray py-3 px-6 rounded-lg font-medium hover:bg-text-gray hover:text-primary-dark transition-colors cursor-pointer"
                >
                  미리보기
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

      {/* Image Preview Modal */}
      {selectedImage !== null && book && (
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center" 
          role="dialog" 
          aria-modal="true"
          aria-labelledby="preview-modal-title"
        >
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/95 backdrop-blur-sm" 
            onClick={() => setSelectedImage(null)}
            aria-label="모달 닫기"
          />

          {/* Modal Content */}
          <div className="relative w-full max-w-[95vw] md:max-w-5xl max-h-[90vh] md:max-h-[95vh] mx-4">
            {/* Hidden title for screen readers */}
            <h2 id="preview-modal-title" className="sr-only">
              {book.title} 미리보기 - {selectedImage}페이지
            </h2>

            {/* Close Button */}
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-12 md:-top-16 right-0 w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/40 text-white hover:bg-black/60 active:bg-black/70 transition-all duration-200 z-20 cursor-pointer text-lg md:text-xl font-bold backdrop-blur-md border border-white/30 focus:outline-none focus:ring-2 focus:ring-accent-orange shadow-lg"
              aria-label="미리보기 닫기"
              tabIndex={0}
            >
              ✕
            </button>

            {/* Navigation Buttons */}
            {selectedImage > 1 && (
              <button
                onClick={goToPreviousImage}
                className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 w-12 h-12 md:w-14 md:h-14 rounded-full bg-black/40 text-white hover:bg-black/60 active:bg-black/70 transition-all duration-200 z-20 cursor-pointer text-xl md:text-2xl font-bold backdrop-blur-md border border-white/30 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-accent-orange shadow-lg"
                aria-label={`이전 페이지 (${selectedImage - 1}/${getTotalImages()})`}
                tabIndex={0}
              >
                ←
              </button>
            )}
            {selectedImage < getTotalImages() && (
              <button
                onClick={goToNextImage}
                className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 w-12 h-12 md:w-14 md:h-14 rounded-full bg-black/40 text-white hover:bg-black/60 active:bg-black/70 transition-all duration-200 z-20 cursor-pointer text-xl md:text-2xl font-bold backdrop-blur-md border border-white/30 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-accent-orange shadow-lg"
                aria-label={`다음 페이지 (${selectedImage + 1}/${getTotalImages()})`}
                tabIndex={0}
              >
                →
              </button>
            )}

            {/* Image Container */}
            <div className="relative flex items-center justify-center overflow-hidden rounded-lg">
              {/* Loading Spinner */}
              {imageLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm rounded-lg z-10">
                  <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                </div>
              )}

              <div className="relative">
                <Image
                  src={getImageSrc(selectedImage)}
                  alt={`${book.title} 미리보기 ${selectedImage}페이지`}
                  width={1000}
                  height={800}
                  className="object-contain rounded-lg shadow-2xl max-w-[90vw] max-h-[90vh]"
                  sizes="(max-width: 768px) 95vw, 80vw"
                  onLoad={() => setImageLoading(false)}
                  onError={() => setImageLoading(false)}
                  priority
                  draggable={false}
                />
              </div>
              
              {/* Page Counter */}
              <div className="absolute bottom-2 md:bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-3 md:px-4 py-1 md:py-2 rounded-full text-xs md:text-sm backdrop-blur-sm border border-white/20 shadow-lg">
                <span className="font-mono">{selectedImage} / {getTotalImages()}</span>
              </div>

              {/* Progress Bar */}
              <div className="absolute bottom-10 md:bottom-16 left-1/2 -translate-x-1/2 w-32 md:w-48 h-1 bg-white/20 rounded-full overflow-hidden shadow-lg">
                <div 
                  className="h-full bg-accent-orange transition-all duration-300"
                  style={{ width: `${(selectedImage / getTotalImages()) * 100}%` }}
                />
              </div>
            </div>

            {/* Instructions - 모바일용 간단한 안내 */}
            <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-white/60 text-xs text-center md:hidden">
              <p>좌우 버튼으로 이동</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
