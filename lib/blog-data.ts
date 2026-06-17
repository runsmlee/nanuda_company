interface BlogPost {
  id: string
  title: string
  excerpt: string
  date: string
  category: string
  readTime: string
  image: string
  author: string
  tags: string[]
}

export const BLOG_POSTS: BlogPost[] = [
  {
    id: "the-fine-line",
    title: "The Fine Line",
    excerpt:
      "싱가포르의 한 카페에서 바퀴벌레와 참새를 바라보며 삶과 죽음, 우연한 경계, 일상의 관찰이 남기는 질문을 여행자의 시선으로 기록한 짧은 에세이입니다.",
    date: "2022-06-02",
    category: "일상의 순간",
    readTime: "3분",
    image: "/blog_images/nanuda_blog_1.png",
    author: "이상민",
    tags: ["싱가포르", "일상", "생각", "철학", "여행"],
  },
  {
    id: "secret-of-life",
    title: "삶의 비밀은 '죽기 전에 죽는 것'",
    excerpt:
      "에고와 진정한 자아에 대한 성찰. 『지금 이 순간을 살아라』를 읽으며 발견한 삶과 죽음, 내려놓음, 현재를 살아가는 태도에 대한 책 이야기입니다.",
    date: "2021-06-18",
    category: "책 이야기",
    readTime: "2분",
    image: "/blog_images/power_of_now.jpeg",
    author: "이상민",
    tags: ["책리뷰", "철학", "에고", "자아", "깨달음"],
  },
  {
    id: "cigarette-butt-diary",
    title: "어느 담배꽁초의 일기",
    excerpt:
      "길가에 버려진 담배꽁초의 목소리를 빌려 환경, 소비, 감사의 감각을 돌아보는 짧은 창작 에세이입니다. 사소한 쓰레기에서 시작한 상상력의 기록입니다.",
    date: "2020-11-09",
    category: "창작 이야기",
    readTime: "4분",
    image: "/blog_images/trash_cigarette.jpg",
    author: "이상민",
    tags: ["창작", "환경", "감사", "상상력", "일기"],
  },
  {
    id: "soju-bottle-letter",
    title: "소주병의 편지",
    excerpt:
      "해변에 버려진 소주병이 편지를 쓴다면 어떤 말을 남길까. 환경, 재활용, 일상의 무심함과 책임을 사물의 시선으로 풀어낸 짧은 창작 이야기입니다.",
    date: "2020-11-29",
    category: "창작 이야기",
    readTime: "3분",
    image: "/blog_images/trash_soju.jpg",
    author: "이상민",
    tags: ["창작", "환경", "재활용", "해변", "쓰레기"],
  },
]

export type { BlogPost }
