export const ONLINE_READER_BOOK_IDS = [
  "gil-eseo-mannada",
  "jarago-sipeun-ai",
  "han-geoleum",
  "annapurna-letter",
] as const

export const ONLINE_READER_META: Record<
  typeof ONLINE_READER_BOOK_IDS[number],
  { label: string; summary: string; description: string }
> = {
  "gil-eseo-mannada": {
    label: "무료 전체 공개본 읽기",
    summary: "19개 장 · 전체 공개 · 약 186분",
    description:
      "책의 전체 내용을 온라인에서 무료로 읽어볼 수 있어요. 남미여행의 시작부터 상파울루에 도착하는 마지막 날까지 담았습니다.",
  },
  "jarago-sipeun-ai": {
    label: "무료 전체 공개본 읽기",
    summary: "10개 장 · 전체 공개 · 사진 73장",
    description:
      "책의 전체 내용을 온라인에서 무료로 읽어볼 수 있어요. 실제 책에 배치된 사진도 함께 담았습니다.",
  },
  "han-geoleum": {
    label: "무료 전체 공개본 읽기",
    summary: "6개 장 · 전체 공개 · 사진 299장",
    description:
      "책의 전체 내용을 온라인에서 무료로 읽어볼 수 있어요. 가족 세계여행 사진과 에필로그도 함께 담았습니다.",
  },
  "annapurna-letter": {
    label: "무료 전체 공개본 읽기",
    summary: "24개 장 · 전체 공개 · 사진 121장",
    description:
      "책의 전체 내용을 온라인에서 무료로 읽어볼 수 있어요. 히말라야 트레킹 사진과 여행 기록도 함께 담았습니다.",
  },
}

export function hasOnlineReader(bookId: string): boolean {
  return ONLINE_READER_BOOK_IDS.includes(bookId as typeof ONLINE_READER_BOOK_IDS[number])
}

export function getOnlineReaderMeta(bookId: string) {
  if (!hasOnlineReader(bookId)) return null

  return ONLINE_READER_META[bookId as typeof ONLINE_READER_BOOK_IDS[number]]
}
