"use client"

import { useEffect, useState } from "react"
import { BOOKS_DATA, type Book } from "@/lib/books-data"

interface BooksCatalogModalProps {
  isOpen: boolean
  onClose: () => void
  onBookSelect: (book: Book) => void
}

export function BooksCatalogModal({ isOpen, onClose, onBookSelect }: BooksCatalogModalProps) {
  const [searchTerm, setSearchTerm] = useState("")

  const filteredBooks = BOOKS_DATA.filter((book) => {
    if (!searchTerm) return true
    return (
      book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.subtitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.author.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })

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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-secondary-dark rounded-lg max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-text-gray/20">
          <h2 className="font-playfair text-3xl font-normal text-text-light">여행서 컬렉션</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div className="p-6 border-b border-text-gray/20">
          <input
            type="text"
            placeholder="책 제목, 부제목, 저자로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 bg-primary-dark border border-text-gray/30 rounded-lg text-text-light placeholder-text-gray focus:border-accent-orange focus:outline-none"
          />
        </div>

        {/* Books Grid */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredBooks.map((book) => (
              <div
                key={book.id}
                onClick={() => onBookSelect(book)}
                className="bg-primary-dark rounded-lg overflow-hidden hover:transform hover:scale-105 transition-all duration-300 cursor-pointer group"
              >
                <div className="aspect-[3/4] overflow-hidden">
                  <img
                    src={book.image || "/placeholder.svg"}
                    alt={book.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                </div>
                <div className="p-3">
                  <h3 className="font-semibold text-text-light mb-1 line-clamp-2 text-sm">{book.title}</h3>
                  <p className="text-text-gray text-xs mb-2 line-clamp-2">{book.subtitle}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-accent-orange font-semibold text-sm">{book.price}</span>
                    <span className="text-xs text-text-gray">{book.author}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredBooks.length === 0 && (
            <div className="text-center py-12">
              <p className="text-text-gray text-lg">검색 결과가 없습니다.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export { BOOKS_DATA }
