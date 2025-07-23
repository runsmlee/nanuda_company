// 책 미리보기 관련 유틸리티 함수들

// 미리보기 가능한 책 ID 목록
export const PREVIEW_BOOK_IDS = [
  "gil-eseo-mannada",
  "han-geoleum", 
  "jarago-sipeun-ai",
  "annapurna-letter"
] as const

// 책별 총 이미지 개수 매핑
export const BOOK_IMAGE_COUNTS: Record<string, number> = {
  "gil-eseo-mannada": 24,
  "han-geoleum": 30,
  "jarago-sipeun-ai": 20,
  "annapurna-letter": 30,
}

// 총 이미지 개수 반환 (메모화된 버전)
export function getTotalImages(bookId: string): number {
  return BOOK_IMAGE_COUNTS[bookId] || 0
}

// 이미지 경로 생성 (메모화된 버전)
export function getImageSrc(bookId: string, imageIndex: number): string {
  switch (bookId) {
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
}

// 미리보기 가능 여부 확인 (메모화된 버전)
export function hasPreview(bookId: string): boolean {
  return PREVIEW_BOOK_IDS.includes(bookId as typeof PREVIEW_BOOK_IDS[number])
}

// React Hook을 위한 유틸리티
export const BookPreviewUtils = {
  getTotalImages,
  getImageSrc,
  hasPreview,
} as const

// 줌/팬 상태 타입
export interface ZoomPanState {
  scale: number
  panX: number
  panY: number
  isZoomed: boolean
}

// 줌/팬 상태 초기값
export const INITIAL_ZOOM_PAN_STATE: ZoomPanState = {
  scale: 1,
  panX: 0,
  panY: 0,
  isZoomed: false,
}

// 줌 제한값
export const ZOOM_LIMITS = {
  MIN: 0.5,
  MAX: 5,
  STEP: 1.5,
} as const

// 터치 제스처 관련 상수
export const TOUCH_CONSTANTS = {
  MIN_SWIPE_DISTANCE: 50,
} as const