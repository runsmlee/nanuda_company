export const ONLINE_READER_BOOK_IDS = [
  "gil-eseo-mannada",
  "jarago-sipeun-ai",
] as const

export const ONLINE_READER_META: Record<
  typeof ONLINE_READER_BOOK_IDS[number],
  { label: string; summary: string }
> = {
  "gil-eseo-mannada": {
    label: "무료 공개본 읽기",
    summary: "9개 장 · 약 110분 공개",
  },
  "jarago-sipeun-ai": {
    label: "무료 전체 공개본 읽기",
    summary: "10개 장 · 전체 공개 · 사진 73장",
  },
}

export function hasOnlineReader(bookId: string): boolean {
  return ONLINE_READER_BOOK_IDS.includes(bookId as typeof ONLINE_READER_BOOK_IDS[number])
}

export function getOnlineReaderMeta(bookId: string) {
  if (!hasOnlineReader(bookId)) return null

  return ONLINE_READER_META[bookId as typeof ONLINE_READER_BOOK_IDS[number]]
}
