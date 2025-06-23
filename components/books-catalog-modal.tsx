"use client"

import { useEffect, useState } from "react"

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

interface BooksCatalogModalProps {
  isOpen: boolean
  onClose: () => void
  onBookSelect: (book: Book) => void
}

const BOOKS_DATA: Book[] = [
  {
    id: "gil-eseo-mannada",
    title: "길에서 만나다",
    subtitle: "남미의 기록",
    price: "17,800원",
    image: "/images/gil-eseo-mannada.jpg",
    description:
      "취업 준비로 바쁜 대학 4학년 시절, 저자는 뻔한 일상에서 벗어나고자 남미여행을 떠난다. 하지만 여전히 뻔한 여행지에서 뻔한 여행객 행세를 하고 있던 그는 여행 시작 10일 만에 위기를 맞는다. 부에노스아이레스 버스터미널에서 여권, 현금 등이 들어있는 배낭을 통째로 도둑맞으며 여행은 전혀 예상치 못한 방향으로 흘러간다. 무일푼이 된 저자는 도둑 맞기 바로 전날 머물렀던 호스텔에 찾아가 허드렛일을 하며 새로운 여행을 계획하게 된다.“난 영리하게 행동하지 않았다. 더 편리한 길을 선택할 수 있는 기회가 종종 있었지만, 그건 마치 내 여정에서 내가 배워야 할 것들을 놓치게 하는 일처럼 느껴졌다.” 라고 저자는 말한다. 육체적인 고됨과 수많은 마음의 투쟁, 생각지 못한 상황의 연속, 많은 사람들과의 만남, 느닷없이 맞이하는 황홀한 자연의 풍경. 이 이야기는 이러한 여정의 기록이다.",
    author: "이상민",
    pages: 284,
    publishDate: "2021년",
    category: "청춘 여행기",
    excerpt:
      "난 영리하게 행동하지 않았다. 더 편리한 길을 선택할 수 있는 기회가 종종 있었지만, 그건 마치 내 여정에서 내가 배워야 할 것들을 놓치게 하는 일처럼 느껴졌다.",
    naverLink: "https://search.shopping.naver.com/book/catalog/32485045676",
  },
  {
    id: "jarago-sipeun-ai",
    title: "자라고 싶은 아이, 아이이고 싶은 어른",
    subtitle: "아빠와 아들의 올레길 여행",
    price: "13,000원",
    image: "/images/jarago-sipeun-ai.jpg",
    description:
      "아빠와 아들이 함께 떠나는 올레길 여행. 아들이 앞장서고 아빠가 뒤따르기. 아이에게 여행의 첫 순간을 선물하기. 둘은 하루 여행 경비 9만원으로 생활하고, 하루 평균 13km의 올레길을 걷고, 게스트하우스를 전전한다. 아이는 성장하고, 아빠는 책임을 내려놓은 채 더 자유로워 진다.",
    author: "이상민, 이상현",
    pages: 198,
    publishDate: "2023년",
    category: "가족 여행",
    excerpt: "아이에게 여행의 첫 순간을 선물하기. 아이가 앞장서고 아빠가 뒤따르기. 잘난 아빠보다는 못난 아빠되기.",
    naverLink: "https://search.shopping.naver.com/book/catalog/32507491713",
  },
  {
    id: "han-geoleum",
    title: "한 걸음에 모든 행복이 담겨있다",
    subtitle: "가족과 함께한 세계여행",
    price: "15,000원",
    image: "/images/han-geoleum.png",
    description:
      "또다시 탈출을 꿈꾸는 남자, 남편 따라 함께 방황해버린 여자, 부모 따라 엉겁결에 집 떠난 아이들의 이야기.",
    author: "이상민, 정예원",
    pages: 312,
    publishDate: "2022년",
    category: "가족 여행",
    excerpt:
      "여행의 목적은 최고의 여행지를 발견하는 것이 아니라 매 순간에서 최고의 여행을 경험하는 것. 그것은 아마도 마음가짐의 문제. 여행자의 눈을 가지면 반복된 일상 속에서도 매 순간 여행의 순간을 발견할 수 있을 것이다.",
    naverLink: "https://search.shopping.naver.com/book/catalog/32549059942",
  },
  {
    id: "annapurna-letter",
    title: "안나푸르나에서 보내는 편지",
    subtitle: "히말라야에서 아이들에게",
    price: "16,500원",
    image: "/images/annapurna-letter.jpg",
    description:
      "가족들과 함께 한 세계여행책 '한걸음에 모든 행복이 담겨있다' 이후 사회로 복귀했던 저자 이상민이 5년 만에 다시 여행길에 올랐다. 아내로부터 1년간의 안식년을 선물 받은 그의 첫 번째 여행지는 히말라야의 안나푸르나다. 포터나 가이드 없이 안나푸르나 지역을 한 달간 트레킹하며 남들이 가지 않는 험한 눈길을 홀로 걷는 등 다른 트레커들 사이에서 '크레이지 코리안', '코리안 머신' 등으로 불렸던 그는 여전히 자신의 한계를 깨기 위한 노력을 진행 중인 듯 하다. 그가 히말라야에서 두 아이에게 전하고 싶었던 이야기를 한 권의 책으로 담았다.",
    author: "이상민",
    pages: 248,
    publishDate: "2023년",
    category: "여행 에세이",
    excerpt:
      "높은 곳에 올라가 '야호' 하고 크게 소리를 질러봐. 이 세상을 다 가진 듯한 기분이 들걸. 사실 맞아. 이 세상은 우리의 것이지. 우리가 그걸 잊고 있었던 것 같아.",
    naverLink: "https://search.shopping.naver.com/book/catalog/40334557631",
  },
  {
    id: "meet-on-the-road",
    title: "Meet On The Road",
    subtitle: "A Journey through South America (English Edition)",
    price: "$12.99",
    image: "/images/meet-on-the-road.jpg",
    description:
      "The English edition of the transformative South American journey. A young Korean man's six-month adventure that began with a stolen backpack in Buenos Aires and evolved into a profound journey of self-discovery, walking thousands of miles and sleeping under the stars.",
    author: "Sangmin Lee",
    pages: 284,
    publishDate: "2024년",
    category: "Travel Memoir",
    amazonLink: "https://www.amazon.com/Meet-Road-Journey-through-America-ebook/dp/B0CL7QM8Z4",
    excerpt:
      "This narrative chronicles a transformative journey that isn't just about the destinations reached but about the metamorphosis of a traveler who began by following maps and ended by following stars.",
  },
]

export function BooksCatalogModal({ isOpen, onClose, onBookSelect }: BooksCatalogModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("전체")
  const [searchTerm, setSearchTerm] = useState("")

  const categories = ["전체", "여행 에세이", "가족 여행", "육아 에세이", "청춘 여행기", "Travel Memoir"]

  const filteredBooks = BOOKS_DATA.filter((book) => {
    const matchesCategory = selectedCategory === "전체" || book.category === selectedCategory
    const matchesSearch =
      book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.subtitle.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesCategory && matchesSearch
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

        {/* Filters */}
        <div className="p-6 border-b border-text-gray/20">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <input
                type="text"
                placeholder="책 제목으로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 bg-primary-dark border border-text-gray/30 rounded-lg text-text-light placeholder-text-gray focus:border-accent-orange focus:outline-none"
              />
            </div>

            {/* Categories */}
            <div className="flex gap-2 overflow-x-auto">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                    selectedCategory === category
                      ? "bg-accent-orange text-white"
                      : "bg-primary-dark text-text-gray hover:bg-text-gray/20"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Books Grid */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                <div className="p-4">
                  <h3 className="font-semibold text-text-light mb-2 line-clamp-2">{book.title}</h3>
                  <p className="text-text-gray text-sm mb-3 line-clamp-2">{book.subtitle}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-accent-orange font-semibold">{book.price}</span>
                    <span className="text-xs text-text-gray">{book.category}</span>
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
