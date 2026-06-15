export const ONLINE_READER_BOOK_IDS = ["gil-eseo-mannada"] as const

export function hasOnlineReader(bookId: string): boolean {
  return ONLINE_READER_BOOK_IDS.includes(bookId as typeof ONLINE_READER_BOOK_IDS[number])
}
