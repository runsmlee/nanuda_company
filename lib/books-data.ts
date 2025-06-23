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
  tableOfContents?: { title: string; page?: number | string }[]
}

export const BOOKS_DATA: Book[] = [
  {
    id: "gil-eseo-mannada",
    title: "길에서 만나다",
    subtitle: "남미의 기록",
    price: "14,000원",
    image: "/images/gil-eseo-mannada.jpg",
    description:
      "취업 준비로 바쁜 대학 4학년 시절, 저자는 뻔한 일상에서 벗어나고자 남미여행을 떠난다. 하지만 여전히 뻔한 여행지에서 뻔한 여행객 행세를 하고 있던 그는 여행 시작 10일 만에 위기를 맞는다. 부에노스아이레스 버스터미널에서 여권, 현금 등이 들어있는 배낭을 통째로 도둑맞으며 여행은 전혀 예상치 못한 방향으로 흘러간다. 무일푼이 된 저자는 도둑 맞기 바로 전날 머물렀던 호스텔에 찾아가 허드렛일을 하며 새로운 여행을 계획하게 된다. '난 영리하게 행동하지 않았다. 더 편리한 길을 선택할 수 있는 기회가 종종 있었지만, 그건 마치 내 여정에서 내가 배워야 할 것들을 놓치게 하는 일처럼 느껴졌다.' 라고 저자는 말한다. 육체적인 고됨과 수많은 마음의 투쟁, 생각지 못한 상황의 연속, 많은 사람들과의 만남, 느닷없이 맞이하는 황홀한 자연의 풍경. 이 이야기는 이러한 여정의 기록이다.",
    author: "이상민",
    pages: 284,
    publishDate: "2021년",
    category: "청춘 여행기",
    excerpt:
      "난 영리하게 행동하지 않았다. 더 편리한 길을 선택할 수 있는 기회가 종종 있었지만, 그건 마치 내 여정에서 내가 배워야 할 것들을 놓치게 하는 일처럼 느껴졌다.",
    naverLink: "https://search.shopping.naver.com/book/catalog/32485045676",
    tableOfContents: [
      { title: "1. 아르헨티나" },
      { title: "버스터미널에서 빈털터리가 되다" },
      { title: "다시 일어서기" },
      { title: "새로운 여정의 시작" },
      { title: "로사리오" },
      { title: "다시 떠나기" },
      { title: "2. 우루과이" },
      { title: "자전거로 국경을 통과하다" },
      { title: "에드와르도와의 작별" },
      { title: "우루과이의 수도, 몬테비데오에 도착하다" },
      { title: "또 다른 도난사건" },
      { title: "걸어서 여행하기" },
      { title: "그리고 히치하이크" },
      { title: "3. 브라질" },
      { title: "걸어서 또 하나의 국경을 통과하다" },
      { title: "노숙자를 위한 무료숙소, Albergue" },
      { title: "두 명의 친구. 줄리아노와 마르코지" },
      { title: "줄리아노와의 헤어짐" },
      { title: "바람의 소리를 듣다" },
      { title: "여행은 여정이 아니라 그 시각이다" },
      { title: "상파울루를 향해" },
    ],
  },
  {
    id: "jarago-sipeun-ai",
    title: "자라고 싶은 아이, 아이이고 싶은 어른",
    subtitle: "아빠와 아들의 올레길 여행",
    price: "8,800원",
    image: "/images/jarago-sipeun-ai.jpg",
    description:
      "아빠와 아들이 함께 떠나는 올레길 여행. 아들이 앞장서고 아빠가 뒤따르기. 아이에게 여행의 첫 순간을 선물하기. 둘은 하루 여행 경비 9만원으로 생활하고, 하루 평균 13km의 올레길을 걷고, 게스트하우스를 전전한다. 아이는 성장하고, 아빠는 책임을 내려놓은 채 더 자유로워 진다.",
    author: "이상민",
    pages: 198,
    publishDate: "2022년",
    category: "가족 여행",
    excerpt: "아이에게 여행의 첫 순간을 선물하기. 아이가 앞장서고 아빠가 뒤따르기. 잘난 아빠보다는 못난 아빠되기.",
    naverLink: "https://search.shopping.naver.com/book/catalog/32507491713",
    tableOfContents: [
      { title: "여행자 '아날로그'" },
      { title: "생각은 쉽지만 실천은 쉽지가 않다" },
      { title: "우리는 태어날 때 핸드폰을 가지고 있지 않았다" },
      { title: "촌놈의 정신은 보다 자유로워라" },
      { title: "잘난 아빠보다는 못난 아빠되기" },
      { title: "건욱이는 착하다" },
      { title: "건욱이와 용돈" },
      { title: "집으로 돌아가는 여행 마지막 날" },
    ],
  },
  {
    id: "han-geoleum",
    title: "한 걸음에 모든 행복이 담겨있다",
    subtitle: "가족과 함께한 세계여행",
    price: "29,500원",
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
    tableOfContents: [
      { title: "Part 0 이야기의 시작, 나" },
      { title: "Part 1 여행의 시작, 우리" },
      { title: "Part 2 여행의 순간, 여기" },
      { title: "Part 3 추억으로의 여행, 그곳" },
      { title: "Part 4 여행의 끝자락에서, 다시" },
    ],
  },
  {
    id: "annapurna-letter",
    title: "안나푸르나에서 보내는 편지",
    subtitle: "히말라야에서 아이들에게",
    price: "14,500원",
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
    tableOfContents: [
      { title: "히말라야로 떠나며" },
      { title: "안나푸르나 베이스캠프로의 여정" },
      { title: "고산에서의 성찰" },
      { title: "아이들에게 전하는 메시지" },
      { title: "돌아오는 길에서" },
    ],
  },
  {
    id: "meet-on-the-road",
    title: "Meet On The Road",
    subtitle: "A Journey through South America (English Edition)",
    price: "$12.00",
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
    tableOfContents: [
      { title: "1. Argentina" },
      { title: "Becoming Penniless at the Bus Terminal" },
      { title: "Rising Again" },
      { title: "Beginning of a New Journey" },
      { title: "Rosario" },
      { title: "Departing Again" },
      { title: "2. Uruguay" },
      { title: "Crossing the Border by Bicycle" },
      { title: "Farewell to Eduardo" },
      { title: "Arriving in Montevideo" },
      { title: "Another Theft Incident" },
      { title: "Traveling on Foot" },
      { title: "And Hitchhiking" },
      { title: "3. Brazil" },
      { title: "Walking Across Another Border" },
      { title: "Free Shelter for the Homeless, Albergue" },
      { title: "Two Friends: Juliano and Marcogi" },
      { title: "Parting with Juliano" },
      { title: "Listening to the Sound of Wind" },
      { title: "Travel is Not a Journey but a Moment" },
      { title: "Towards São Paulo" },
    ],
  },
]

export type { Book } 