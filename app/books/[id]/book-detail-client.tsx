"use client"

import { useEffect, useState, useCallback } from "react"
import Image from "next/image"
import Link from "next/link"
import { BOOKS_DATA, type Book } from "@/lib/books-data"

interface BookDetailClientProps {
  book: Book
}

export default function BookDetailClient({ book }: BookDetailClientProps) {
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

  // 총 이미지 개수 계산 함수
  const getTotalImages = useCallback(() => {
    switch (book.id) {
      case "gil-eseo-mannada": return 24
      case "han-geoleum": return 30
      case "jarago-sipeun-ai": return 20
      case "annapurna-letter": return 30
      default: return 0
    }
  }, [book.id])

  // 이미지 경로 생성 함수
  const getImageSrc = useCallback((imageIndex: number) => {
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
  }, [book.id])

  // 페이지 로드 시 맨 위로 스크롤
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [book.id])

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
      resetZoomAndPan() // 새 이미지로 이동시 줌 리셋
    }
  }, [selectedImage, resetZoomAndPan])

  const goToNextImage = useCallback(() => {
    const totalImages = getTotalImages()
    if (selectedImage !== null && selectedImage < totalImages) {
      setImageLoading(true)
      setSelectedImage(selectedImage + 1)
      resetZoomAndPan() // 새 이미지로 이동시 줌 리셋
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

  // 마우스 휠 줌
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setScale(prev => {
      const newScale = Math.max(0.5, Math.min(prev * delta, 5))
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

  // 마우스 팬 시작
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale > 1) {
      setIsPanning(true)
      setLastPanPoint({ x: e.clientX, y: e.clientY })
      e.preventDefault()
    }
  }, [scale])

  // 마우스 팬 이동
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning && scale > 1) {
      const deltaX = e.clientX - lastPanPoint.x
      const deltaY = e.clientY - lastPanPoint.y
      
      setPanX(prev => prev + deltaX)
      setPanY(prev => prev + deltaY)
      setLastPanPoint({ x: e.clientX, y: e.clientY })
      e.preventDefault()
    }
  }, [isPanning, lastPanPoint, scale])

  // 마우스 팬 종료
  const handleMouseUp = useCallback(() => {
    setIsPanning(false)
  }, [])

  // 터치 제스처 처리
  const minSwipeDistance = 50
  const [touchDistance, setTouchDistance] = useState(0)
  const [initialTouches, setInitialTouches] = useState<React.Touch[]>([])

  // 두 터치 포인트간 거리 계산
  const getTouchDistance = (touches: TouchList) => {
    if (touches.length < 2) return 0
    const touch1 = touches[0]
    const touch2 = touches[1]
    return Math.sqrt(
      Math.pow(touch1.clientX - touch2.clientX, 2) + 
      Math.pow(touch1.clientY - touch2.clientY, 2)
    )
  }

  const onTouchStart = (e: React.TouchEvent) => {
    const touches = e.targetTouches
    
    if (touches.length === 1) {
      // 단일 터치 - 스와이프 또는 팬
      setTouchEnd(null)
      setTouchStart(touches[0].clientX)
      
      if (scale > 1) {
        setIsPanning(true)
        setLastPanPoint({ x: touches[0].clientX, y: touches[0].clientY })
      }
    } else if (touches.length === 2) {
      // 핀치 줌
      const distance = getTouchDistance(touches)
      setTouchDistance(distance)
      setInitialTouches(Array.from(touches))
      setIsPanning(false)
    }
  }

  const onTouchMove = (e: React.TouchEvent) => {
    const touches = e.targetTouches
    
    if (touches.length === 1 && isPanning && scale > 1) {
      // 팬 이동
      const touch = touches[0]
      const deltaX = touch.clientX - lastPanPoint.x
      const deltaY = touch.clientY - lastPanPoint.y
      
      setPanX(prev => prev + deltaX)
      setPanY(prev => prev + deltaY)
      setLastPanPoint({ x: touch.clientX, y: touch.clientY })
      e.preventDefault()
    } else if (touches.length === 2 && touchDistance > 0) {
      // 핀치 줌
      const currentDistance = getTouchDistance(touches)
      const scaleChange = currentDistance / touchDistance
      
      setScale(prev => {
        const newScale = Math.max(0.5, Math.min(prev * scaleChange, 5))
        if (newScale <= 1) {
          setPanX(0)
          setPanY(0)
          setIsZoomed(false)
          return 1
        }
        setIsZoomed(true)
        return newScale
      })
      
      setTouchDistance(currentDistance)
      e.preventDefault()
    } else if (touches.length === 1 && !isPanning) {
      // 스와이프용 터치 추적
      setTouchEnd(touches[0].clientX)
    }
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    const touches = e.targetTouches
    
    if (touches.length === 0) {
      setIsPanning(false)
      
      // 스와이프 감지 (줌되지 않은 상태에서만)
      if (scale <= 1 && touchStart !== null && touchEnd !== null) {
        const distance = touchStart - touchEnd
        const isLeftSwipe = distance > minSwipeDistance
        const isRightSwipe = distance < -minSwipeDistance

        if (isLeftSwipe) {
          goToNextImage()
        } else if (isRightSwipe) {
          goToPreviousImage()
        }
      }
      
      setTouchStart(null)
      setTouchEnd(null)
      setTouchDistance(0)
      setInitialTouches([])
    }
  }

  // 이미지 모달 관련 키보드 이벤트 및 휠 이벤트
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedImage !== null) {
        if (e.key === 'Escape') {
          setSelectedImage(null)
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault()
          goToPreviousImage()
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          goToNextImage()
        } else if (e.key === '+' || e.key === '=') {
          e.preventDefault()
          zoomIn()
        } else if (e.key === '-') {
          e.preventDefault()
          zoomOut()
        } else if (e.key === '0') {
          e.preventDefault()
          resetZoomAndPan()
        }
      }
    }

    if (selectedImage !== null) {
      const imageContainer = document.querySelector('[data-image-container]')
      if (imageContainer) {
        imageContainer.addEventListener('wheel', handleWheel, { passive: false })
      }
      
      window.addEventListener('keydown', handleKeyDown)
      window.addEventListener('mouseup', handleMouseUp)
      
      return () => {
        if (imageContainer) {
          imageContainer.removeEventListener('wheel', handleWheel)
        }
        window.removeEventListener('keydown', handleKeyDown)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [selectedImage, goToPreviousImage, goToNextImage, handleWheel, handleMouseUp, zoomIn, zoomOut, resetZoomAndPan])

  // 이미지 변경 시 줌 상태 리셋
  useEffect(() => {
    if (selectedImage !== null) {
      resetZoomAndPan()
    }
  }, [selectedImage, resetZoomAndPan])

  // 모달이 열릴 때 스크롤 방지 및 포커스 관리
  useEffect(() => {
    if (selectedImage !== null) {
      document.body.style.overflow = 'hidden'
      
      // 모달 내 포커스 가능한 요소들
      const focusableSelectors = [
        'button:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
      ]
      
      const modal = document.querySelector('[data-modal="preview"]')
      if (modal) {
        const focusableElements = modal.querySelectorAll(focusableSelectors.join(', '))
        const firstFocusable = focusableElements[0] as HTMLElement
        const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement
        
        // 첫 번째 요소에 포커스
        if (firstFocusable) {
          firstFocusable.focus()
        }
        
        // Tab 키 트랩 처리
        const handleTabTrap = (e: KeyboardEvent) => {
          if (e.key === 'Tab') {
            if (e.shiftKey) {
              if (document.activeElement === firstFocusable) {
                e.preventDefault()
                lastFocusable?.focus()
              }
            } else {
              if (document.activeElement === lastFocusable) {
                e.preventDefault()
                firstFocusable?.focus()
              }
            }
          }
        }
        
        document.addEventListener('keydown', handleTabTrap)
        
        return () => {
          document.removeEventListener('keydown', handleTabTrap)
        }
      }
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
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center" 
          role="dialog" 
          aria-modal="true"
          aria-labelledby="modal-title"
          data-modal="preview"
        >
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/95 backdrop-blur-sm" 
            onClick={() => setSelectedImage(null)}
            aria-label="모달 닫기"
          />

          {/* Modal Content */}
          <div 
            className="relative max-w-5xl max-h-[95vh] mx-4 w-full"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {/* Hidden title for screen readers */}
            <h2 id="modal-title" className="sr-only">
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
            <div 
              className="relative w-full max-w-[95vw] md:max-w-5xl max-h-[90vh] md:max-h-[95vh] flex items-center justify-center overflow-hidden rounded-lg"
              data-image-container
            >
              {/* Loading Spinner */}
              {imageLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm rounded-lg z-10">
                  <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                </div>
              )}

              <div
                className="relative cursor-grab active:cursor-grabbing"
                style={{
                  transform: `scale(${scale}) translate(${panX / scale}px, ${panY / scale}px)`,
                  transition: isPanning ? 'none' : 'transform 0.2s ease-out',
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
              >
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
              
              {/* Zoom Controls */}
              <div className="absolute top-2 md:top-4 right-2 md:right-4 flex flex-col gap-1 md:gap-2 z-30">
                <button
                  onClick={zoomIn}
                  className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-black/40 text-white hover:bg-black/60 active:bg-black/70 transition-all duration-200 backdrop-blur-md border border-white/30 flex items-center justify-center text-sm md:text-lg font-bold focus:outline-none focus:ring-2 focus:ring-accent-orange shadow-lg"
                  aria-label="확대"
                  disabled={scale >= 5}
                >
                  +
                </button>
                <button
                  onClick={zoomOut}
                  className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-black/40 text-white hover:bg-black/60 active:bg-black/70 transition-all duration-200 backdrop-blur-md border border-white/30 flex items-center justify-center text-sm md:text-lg font-bold focus:outline-none focus:ring-2 focus:ring-accent-orange shadow-lg"
                  aria-label="축소"
                  disabled={scale <= 0.5}
                >
                  −
                </button>
                <button
                  onClick={resetZoomAndPan}
                  className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-black/40 text-white hover:bg-black/60 active:bg-black/70 transition-all duration-200 backdrop-blur-md border border-white/30 flex items-center justify-center text-xs md:text-xs font-bold focus:outline-none focus:ring-2 focus:ring-accent-orange shadow-lg"
                  aria-label="원본 크기"
                  disabled={scale === 1 && panX === 0 && panY === 0}
                >
                  1:1
                </button>
              </div>

              {/* Zoom Level Indicator */}
              {isZoomed && (
                <div className="absolute top-2 md:top-4 left-2 md:left-4 bg-black/60 text-white px-2 md:px-3 py-1 rounded-full text-xs md:text-sm backdrop-blur-sm border border-white/20 shadow-lg">
                  {Math.round(scale * 100)}%
                </div>
              )}
              
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
              <p>스와이프로 이동 • 핀치로 확대</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
} 