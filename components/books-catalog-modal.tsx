"use client"

import { useState } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { Search, X } from "lucide-react"
import { BOOKS_DATA, type Book } from "@/lib/books-data"
import { hasOnlineReader } from "@/lib/book-reader-config"

interface BooksCatalogModalProps {
  isOpen: boolean
  onClose: () => void
  onBookSelect: (book: Book) => void
}

/** Cover that fades in as it loads — the warm #181210 panel shows through until then,
 *  so a missing/slow image reads as a print still developing rather than a blank pop-in. */
function BookCover({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false)

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onLoad={() => setLoaded(true)}
      className={`h-full w-full object-cover transition duration-500 ease-out group-hover:brightness-[1.08] ${
        loaded ? "opacity-100" : "opacity-0"
      }`}
    />
  )
}

export function BooksCatalogModal({ isOpen, onClose, onBookSelect }: BooksCatalogModalProps) {
  const [searchTerm, setSearchTerm] = useState("")

  const filteredBooks = BOOKS_DATA.filter((book) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      book.title.toLowerCase().includes(term) ||
      book.subtitle.toLowerCase().includes(term) ||
      book.author.toLowerCase().includes(term)
    )
  })

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setSearchTerm("")
          onClose()
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-[#0b0806]/90 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />

        <Dialog.Content
          aria-describedby="books-catalog-desc"
          className="fixed left-1/2 top-1/2 z-[100] flex max-h-[90vh] w-[calc(100%-2rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-md bg-[#211a15] bg-noise shadow-[0_24px_60px_-15px_rgba(0,0,0,0.7)] focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-4 border-b border-[#3a2e25] px-6 py-5">
            <Dialog.Title className="font-myeongjo text-3xl font-normal text-[#f1e9df]">
              여행서 컬렉션
            </Dialog.Title>
            <Dialog.Close
              aria-label="닫기"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#a99a8a] transition-colors hover:bg-white/5 hover:text-[#f1e9df] focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-orange/60"
            >
              <X className="h-5 w-5" strokeWidth={1.5} />
            </Dialog.Close>
          </div>
          <Dialog.Description id="books-catalog-desc" className="sr-only">
            제목, 부제목, 저자로 여행서를 검색하고 선택해 자세히 볼 수 있습니다.
          </Dialog.Description>

          {/* Search */}
          <div className="border-b border-[#3a2e25] px-6 py-5">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a7d6f]"
                strokeWidth={1.5}
              />
              <input
                type="text"
                placeholder="책 제목, 부제목, 저자로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-md border border-[#3a2e25] bg-[#181210] py-3 pl-11 pr-11 text-[#f1e9df] placeholder-[#8a7d6f] focus:border-accent-orange focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-orange/50"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  aria-label="검색어 지우기"
                  className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[#a99a8a] transition-colors hover:bg-white/5 hover:text-[#f1e9df] focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-orange/60"
                >
                  <X className="h-4 w-4" strokeWidth={1.5} />
                </button>
              )}
            </div>
            <p className="mt-3 text-xs text-[#a99a8a]" aria-live="polite">
              {searchTerm
                ? `‘${searchTerm}’ 검색 결과 ${filteredBooks.length}권`
                : `전체 ${BOOKS_DATA.length}권의 여행서`}
            </p>
          </div>

          {/* Books Grid — covers pinned like photographs on the dark */}
          <div className="flex-1 overflow-y-auto px-6 py-7">
            {filteredBooks.length > 0 ? (
              <div className="grid grid-cols-2 gap-x-6 gap-y-9 sm:grid-cols-3">
                {filteredBooks.map((book, index) => (
                  <button
                    key={book.id}
                    type="button"
                    onClick={() => onBookSelect(book)}
                    className="group flex flex-col text-left focus:outline-none"
                  >
                    <div
                      className={`aspect-[3/4] overflow-hidden rounded-[3px] bg-[#181210] ring-1 ring-[#3a2e25] shadow-[0_10px_22px_-10px_rgba(0,0,0,0.8)] ${
                        index % 2 === 0 ? "-rotate-[0.5deg]" : "rotate-[0.5deg]"
                      } transition-all duration-300 ease-out group-hover:rotate-0 group-hover:-translate-y-1 group-hover:shadow-[0_20px_36px_-12px_rgba(0,0,0,0.95)] group-active:rotate-0 group-active:-translate-y-1 group-focus-visible:rotate-0 group-focus-visible:ring-accent-orange/60 group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-[#211a15]`}
                    >
                      <BookCover src={book.image || "/placeholder.svg"} alt={`${book.title} 표지`} />
                    </div>
                    <div className="flex flex-1 flex-col px-0.5 pt-3.5">
                      {hasOnlineReader(book.id) && (
                        <span className="mb-2 inline-flex w-fit items-center rounded-sm border border-[#3a2e25] px-1.5 py-0.5 text-[10px] text-[#c9b8a4]">
                          무료 공개본
                        </span>
                      )}
                      <h3 className="line-clamp-2 font-myeongjo text-lg leading-snug text-[#f1e9df]">
                        {book.title}
                      </h3>
                      {/* the rare flame — orange ignites only as you reach toward a book */}
                      <span
                        aria-hidden
                        className="mt-2 block h-px w-6 origin-left scale-x-0 bg-accent-orange transition-transform duration-300 ease-out group-hover:scale-x-100 group-active:scale-x-100 group-focus-visible:scale-x-100"
                      />
                      <p className="mt-2 line-clamp-1 text-xs leading-relaxed text-[#a99a8a]">
                        {book.subtitle}
                      </p>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-sm text-[#f1e9df]/85">{book.price}</span>
                        <span className="text-xs text-[#a99a8a]">{book.author}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                <p className="font-myeongjo text-xl text-[#f1e9df]">아직 닿지 못한 길이네요.</p>
                <p className="text-sm text-[#a99a8a]">‘{searchTerm}’과(와) 맞는 여행서를 찾지 못했어요.</p>
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="mt-1 rounded text-sm text-accent-orange transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-orange/60"
                >
                  검색 지우기
                </button>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export { BOOKS_DATA }
