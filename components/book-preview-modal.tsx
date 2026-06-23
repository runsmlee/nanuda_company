"use client"

import { useEffect, useState, useCallback, useMemo, memo, useRef } from "react"
import Image from "next/image"
import * as Dialog from "@radix-ui/react-dialog"
import { ChevronLeft, ChevronRight, RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react"
import { getTotalImages, getImageSrc, ZOOM_LIMITS, TOUCH_CONSTANTS } from "@/lib/book-preview-utils"

interface BookPreviewModalProps {
  bookId: string
  bookTitle: string
  selectedImage: number | null
  onClose: () => void
  onNavigate: (direction: 'prev' | 'next') => void
  enableZoom?: boolean
}

const BookPreviewModalComponent = function BookPreviewModal({ 
  bookId, 
  bookTitle, 
  selectedImage, 
  onClose, 
  onNavigate,
  enableZoom = false 
}: BookPreviewModalProps) {
  const [imageLoading, setImageLoading] = useState(false)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  
  // 줌/팬 상태 (enableZoom이 true일 때만 사용)
  const [scale, setScale] = useState(1)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [isPanning, setIsPanning] = useState(false)
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 })
  const [isZoomed, setIsZoomed] = useState(false)
  
  // 터치 제스처 상태
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)
  const [touchDistance, setTouchDistance] = useState(0)

  // 메모화된 값들
  const totalImages = useMemo(() => getTotalImages(bookId), [bookId])
  const currentImageSrc = useMemo(() => 
    selectedImage ? getImageSrc(bookId, selectedImage) : "", 
    [bookId, selectedImage]
  )

  // 줌/팬 리셋
  const resetZoomAndPan = useCallback(() => {
    setScale(1)
    setPanX(0)
    setPanY(0)
    setIsZoomed(false)
  }, [])

  // 줌 함수들 (enableZoom이 true일 때만)
  const zoomIn = useCallback(() => {
    if (!enableZoom) return
    setScale(prev => Math.min(prev * ZOOM_LIMITS.STEP, ZOOM_LIMITS.MAX))
    setIsZoomed(true)
  }, [enableZoom])

  const zoomOut = useCallback(() => {
    if (!enableZoom) return
    setScale(prev => {
      const newScale = Math.max(prev / ZOOM_LIMITS.STEP, ZOOM_LIMITS.MIN)
      if (newScale <= 1) {
        setPanX(0)
        setPanY(0)
        setIsZoomed(false)
        return 1
      }
      setIsZoomed(true)
      return newScale
    })
  }, [enableZoom])

  // 네비게이션 함수들
  const goToPrevious = useCallback(() => {
    if (selectedImage && selectedImage > 1) {
      onNavigate('prev')
      if (enableZoom) resetZoomAndPan()
    }
  }, [selectedImage, onNavigate, enableZoom, resetZoomAndPan])

  const goToNext = useCallback(() => {
    if (selectedImage && selectedImage < totalImages) {
      onNavigate('next')
      if (enableZoom) resetZoomAndPan()
    }
  }, [selectedImage, totalImages, onNavigate, enableZoom, resetZoomAndPan])

  // 마우스 휠 줌 (enableZoom이 true일 때만)
  const handleWheel = useCallback((e: WheelEvent) => {
    if (!enableZoom) return
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setScale(prev => {
      const newScale = Math.max(ZOOM_LIMITS.MIN, Math.min(prev * delta, ZOOM_LIMITS.MAX))
      if (newScale <= 1) {
        setPanX(0)
        setPanY(0)
        setIsZoomed(false)
        return 1
      }
      setIsZoomed(true)
      return newScale
    })
  }, [enableZoom])

  // 터치 제스처 처리
  const getTouchDistance = (touches: React.TouchList) => {
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
      setTouchEnd(null)
      setTouchStart(touches[0].clientX)
      
      if (enableZoom && scale > 1) {
        setIsPanning(true)
        setLastPanPoint({ x: touches[0].clientX, y: touches[0].clientY })
      }
    } else if (touches.length === 2 && enableZoom) {
      const distance = getTouchDistance(touches)
      setTouchDistance(distance)
      setIsPanning(false)
    }
  }

  const onTouchMove = (e: React.TouchEvent) => {
    const touches = e.targetTouches
    
    if (touches.length === 1 && enableZoom && isPanning && scale > 1) {
      const touch = touches[0]
      const deltaX = touch.clientX - lastPanPoint.x
      const deltaY = touch.clientY - lastPanPoint.y
      
      setPanX(prev => prev + deltaX)
      setPanY(prev => prev + deltaY)
      setLastPanPoint({ x: touch.clientX, y: touch.clientY })
      e.preventDefault()
    } else if (touches.length === 2 && enableZoom && touchDistance > 0) {
      const currentDistance = getTouchDistance(touches)
      const scaleChange = currentDistance / touchDistance
      
      setScale(prev => {
        const newScale = Math.max(ZOOM_LIMITS.MIN, Math.min(prev * scaleChange, ZOOM_LIMITS.MAX))
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
      setTouchEnd(touches[0].clientX)
    }
  }

  const onTouchEnd = () => {
    setIsPanning(false)
    
    // 스와이프 감지 (줌되지 않은 상태에서만)
    if (scale <= 1 && touchStart !== null && touchEnd !== null) {
      const distance = touchStart - touchEnd
      const isLeftSwipe = distance > TOUCH_CONSTANTS.MIN_SWIPE_DISTANCE
      const isRightSwipe = distance < -TOUCH_CONSTANTS.MIN_SWIPE_DISTANCE

      if (isLeftSwipe) {
        goToNext()
      } else if (isRightSwipe) {
        goToPrevious()
      }
    }
    
    setTouchStart(null)
    setTouchEnd(null)
    setTouchDistance(0)
  }

  // 키보드 이벤트
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedImage === null) return
      
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goToPrevious()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        goToNext()
      } else if (enableZoom) {
        if (e.key === '+' || e.key === '=') {
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
      window.addEventListener('keydown', handleKeyDown)
      
      if (enableZoom) {
        const imageContainer = document.querySelector<HTMLElement>('[data-image-container]')
        if (imageContainer) {
          imageContainer.addEventListener('wheel', handleWheel, { passive: false })
        }
        
        return () => {
          window.removeEventListener('keydown', handleKeyDown)
          if (imageContainer) {
            imageContainer.removeEventListener('wheel', handleWheel)
          }
        }
      }
      
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedImage, goToPrevious, goToNext, zoomIn, zoomOut, resetZoomAndPan, handleWheel, enableZoom, onClose])

  // 이미지 변경 시 줌 리셋
  useEffect(() => {
    if (selectedImage !== null && enableZoom) {
      resetZoomAndPan()
    }
  }, [selectedImage, resetZoomAndPan, enableZoom])

  if (selectedImage === null) return null

  return (
    <Dialog.Root
      open={selectedImage !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-sm" />

        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[201] w-[calc(100vw-2rem)] max-w-[95vw] -translate-x-1/2 -translate-y-1/2 focus:outline-none md:max-w-5xl"
          data-modal="preview"
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            closeButtonRef.current?.focus()
          }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
        {/* Hidden title for screen readers */}
        <Dialog.Title className="sr-only">
          {bookTitle} 책 속지 보기 - {selectedImage}페이지
        </Dialog.Title>

        {/* Close Button */}
        <Dialog.Close
          ref={closeButtonRef}
          className="absolute -top-12 md:-top-16 right-0 h-11 w-11 md:h-12 md:w-12 rounded-full bg-black/40 text-white hover:bg-black/60 active:bg-black/70 transition-all duration-200 z-20 cursor-pointer text-lg md:text-xl font-bold backdrop-blur-md border border-white/30 focus:outline-none focus:ring-2 focus:ring-accent-orange shadow-lg"
          aria-label="책 속지 보기 닫기"
        >
          <X className="mx-auto h-5 w-5" aria-hidden="true" />
        </Dialog.Close>

        {/* Navigation Buttons */}
        {selectedImage > 1 && (
          <button
            onClick={goToPrevious}
            className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 w-12 h-12 md:w-14 md:h-14 rounded-full bg-black/40 text-white hover:bg-black/60 active:bg-black/70 transition-all duration-200 z-20 cursor-pointer text-xl md:text-2xl font-bold backdrop-blur-md border border-white/30 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-accent-orange shadow-lg"
            aria-label={`이전 페이지 (${selectedImage - 1}/${totalImages})`}
            tabIndex={0}
          >
            <ChevronLeft className="h-6 w-6" aria-hidden="true" />
          </button>
        )}
        {selectedImage < totalImages && (
          <button
            onClick={goToNext}
            className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 w-12 h-12 md:w-14 md:h-14 rounded-full bg-black/40 text-white hover:bg-black/60 active:bg-black/70 transition-all duration-200 z-20 cursor-pointer text-xl md:text-2xl font-bold backdrop-blur-md border border-white/30 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-accent-orange shadow-lg"
            aria-label={`다음 페이지 (${selectedImage + 1}/${totalImages})`}
            tabIndex={0}
          >
            <ChevronRight className="h-6 w-6" aria-hidden="true" />
          </button>
        )}

        {/* Image Container */}
        <div 
          className="relative flex items-center justify-center overflow-hidden rounded-lg"
          data-image-container
        >
          {/* Loading Spinner */}
          {imageLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm rounded-lg z-10">
              <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            </div>
          )}

          <div
            className={`relative ${enableZoom ? 'cursor-grab active:cursor-grabbing' : ''}`}
            style={enableZoom ? {
              transform: `scale(${scale}) translate(${panX / scale}px, ${panY / scale}px)`,
              transition: isPanning ? 'none' : 'transform 0.2s ease-out',
            } : {}}
            onMouseDown={enableZoom ? (e: React.MouseEvent) => {
              if (scale > 1) {
                setIsPanning(true)
                setLastPanPoint({ x: e.clientX, y: e.clientY })
                e.preventDefault()
              }
            } : undefined}
            onMouseMove={enableZoom ? (e: React.MouseEvent) => {
              if (isPanning && scale > 1) {
                const deltaX = e.clientX - lastPanPoint.x
                const deltaY = e.clientY - lastPanPoint.y
                
                setPanX(prev => prev + deltaX)
                setPanY(prev => prev + deltaY)
                setLastPanPoint({ x: e.clientX, y: e.clientY })
                e.preventDefault()
              }
            } : undefined}
          >
            <Image
              src={currentImageSrc}
              alt={`${bookTitle} 책 속지 ${selectedImage}페이지`}
              width={1000}
              height={800}
              className="object-contain rounded-lg shadow-2xl max-w-[90vw] max-h-[90vh]"
              sizes="(max-width: 768px) 95vw, 80vw"
              onLoad={() => setImageLoading(false)}
              onError={() => setImageLoading(false)}
              loading="eager"
              draggable={false}
            />
          </div>
          
          {/* Zoom Controls - enableZoom이 true일 때만 표시 */}
          {enableZoom && (
            <div className="absolute top-2 md:top-4 right-2 md:right-4 flex flex-col gap-1 md:gap-2 z-30">
              <button
                onClick={zoomIn}
                className="h-11 w-11 rounded-full bg-black/40 text-white hover:bg-black/60 active:bg-black/70 transition-all duration-200 backdrop-blur-md border border-white/30 flex items-center justify-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-accent-orange shadow-lg"
                aria-label="확대"
                disabled={scale >= ZOOM_LIMITS.MAX}
              >
                <ZoomIn className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                onClick={zoomOut}
                className="h-11 w-11 rounded-full bg-black/40 text-white hover:bg-black/60 active:bg-black/70 transition-all duration-200 backdrop-blur-md border border-white/30 flex items-center justify-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-accent-orange shadow-lg"
                aria-label="축소"
                disabled={scale <= ZOOM_LIMITS.MIN}
              >
                <ZoomOut className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                onClick={resetZoomAndPan}
                className="h-11 w-11 rounded-full bg-black/40 text-white hover:bg-black/60 active:bg-black/70 transition-all duration-200 backdrop-blur-md border border-white/30 flex items-center justify-center text-xs font-bold focus:outline-none focus:ring-2 focus:ring-accent-orange shadow-lg"
                aria-label="원본 크기"
                disabled={scale === 1 && panX === 0 && panY === 0}
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* Zoom Level Indicator - enableZoom이 true이고 줌된 상태일 때만 표시 */}
          {enableZoom && isZoomed && (
            <div className="absolute top-2 md:top-4 left-2 md:left-4 bg-black/60 text-white px-2 md:px-3 py-1 rounded-full text-xs md:text-sm backdrop-blur-sm border border-white/20 shadow-lg">
              {Math.round(scale * 100)}%
            </div>
          )}
          
          {/* Page Counter */}
          <div className="absolute bottom-2 md:bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-3 md:px-4 py-1 md:py-2 rounded-full text-xs md:text-sm backdrop-blur-sm border border-white/20 shadow-lg">
            <span className="font-mono">{selectedImage} / {totalImages}</span>
          </div>

          {/* Progress Bar */}
          <div className="absolute bottom-10 md:bottom-16 left-1/2 -translate-x-1/2 w-32 md:w-48 h-1 bg-white/20 rounded-full overflow-hidden shadow-lg">
            <div 
              className="h-full bg-accent-orange transition-all duration-300"
              style={{ width: `${(selectedImage / totalImages) * 100}%` }}
            />
          </div>
        </div>

        <Dialog.Description className="sr-only">
          {enableZoom ? "스와이프로 이동하고 핀치로 확대할 수 있습니다." : "좌우 버튼으로 책 속지를 이동할 수 있습니다."}
        </Dialog.Description>

        {/* Instructions */}
        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-white/60 text-xs text-center md:hidden" aria-hidden="true">
          <p>{enableZoom ? "스와이프로 이동 • 핀치로 확대" : "좌우 버튼으로 이동"}</p>
        </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// 메모화된 컴포넌트 export
export const BookPreviewModal = memo(BookPreviewModalComponent)
