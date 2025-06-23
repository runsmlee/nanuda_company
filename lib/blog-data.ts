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
    excerpt: "싱가포르 카페에서 바퀴벌레와 참새를 통해 목격한 삶과 죽음",
    date: "2022.06.02",
    category: "일상의 순간",
    readTime: "3분",
    image: "/blog_images/nanuda_blog_1.png",
    author: "이상민",
    tags: ["싱가포르", "일상", "생각", "철학", "여행"],
  },
  {
    id: "secret-of-life",
    title: "삶의 비밀은 '죽기 전에 죽는 것'",
    excerpt: "에고와 진정한 자아에 대한 성찰. 『지금 이 순간을 살아라』에서 발견한 삶과 죽음에 대한 깊은 통찰.",
    date: "2021.06.18",
    category: "책 이야기",
    readTime: "2분",
    image: "/blog_images/power_of_now.jpeg",
    author: "이상민",
    tags: ["책리뷰", "철학", "에고", "자아", "깨달음"],
  },
  {
    id: "cigarette-butt-diary",
    title: "어느 담배꽁초의 일기",
    excerpt: "담배꽁초가 전하는 이야기",
    date: "2020.11.09",
    category: "창작 이야기",
    readTime: "4분",
    image: "/blog_images/trash_cigarette.jpg",
    author: "이상민",
    tags: ["창작", "환경", "감사", "상상력", "일기"],
  },
  {
    id: "soju-bottle-letter",
    title: "소주병의 편지",
    excerpt: "해변에 버려진 소주병이 전하는 메시지.",
    date: "2020.11.29",
    category: "창작 이야기",
    readTime: "3분",
    image: "/blog_images/trash_soju.jpg",
    author: "이상민",
    tags: ["창작", "환경", "재활용", "해변", "쓰레기"],
  },
]

export type { BlogPost } 