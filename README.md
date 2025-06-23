# 생각을나누다 (Nanuda Company)

> 우리의 가치 있는 경험과 생각을 담은 여행 에세이 출판사

![생각을나누다 로고](public/images/nanuda_logo.png)

## 📖 프로젝트 소개

생각을나누다는 여행과 인생의 경험을 담은 에세이를 출간하는 출판사입니다. 이 웹사이트는 우리의 도서를 소개하고, 저자들의 이야기를 공유하며, 독자들과 소통하는 플랫폼입니다.

### 🌟 주요 특징

- **반응형 디자인**: 모든 디바이스에서 최적화된 사용자 경험
- **인터랙티브 UI**: 커스텀 커서와 부드러운 스크롤 애니메이션
- **도서 카탈로그**: 상세한 도서 정보와 미리보기 기능
- **블로그 시스템**: 마크다운 기반 콘텐츠 관리
- **SEO 최적화**: 검색 엔진 최적화 및 소셜 미디어 메타 태그

## 🚀 기술 스택

### 프론트엔드
- **Next.js 15.2.4** - React 기반 풀스택 프레임워크
- **TypeScript** - 타입 안전성을 위한 정적 타입 언어
- **Tailwind CSS** - 유틸리티 우선 CSS 프레임워크
- **Shadcn/ui** - 재사용 가능한 UI 컴포넌트 라이브러리

### UI/UX 라이브러리
- **Radix UI** - 접근성이 뛰어난 헤드리스 UI 컴포넌트
- **Lucide React** - 아이콘 라이브러리
- **Embla Carousel** - 터치 친화적 캐러셀
- **Sonner** - 토스트 알림

### 콘텐츠 관리
- **Gray Matter** - 마크다운 프론트매터 파싱
- **Remark** - 마크다운 프로세싱

### 폼 관리
- **React Hook Form** - 성능 최적화된 폼 라이브러리
- **Zod** - 스키마 검증

## 📚 출간 도서

### 1. 길에서 만나다 (2021)
- **저자**: 이상민
- **장르**: 청춘 여행기
- **가격**: 14,000원
- 남미 여행 중 도둑을 맞고 비로소 시작된 저자의 진짜 여행

### 2. 자라고 싶은 아이, 아이이고 싶은 어른 (2022)
- **저자**: 이상민
- **장르**: 가족 여행
- **가격**: 8,800원
- 아빠와 아들이 함께 떠나는 올레길 여행

### 3. 한 걸음에 모든 행복이 담겨있다 (2022)
- **저자**: 이상민, 정예원
- **장르**: 가족 여행
- **가격**: 29,500원
- 회사를 그만두고 훌쩍 떠난 가족의 세계여행 이야기

### 4. 안나푸르나에서 보내는 편지 (2023)
- **저자**: 이상민
- **장르**: 여행 에세이
- **가격**: 14,500원
- 히말라야에서 보내는 아빠의 편지

### 5. Meet On The Road (2024)
- **저자**: Sangmin Lee
- **장르**: Travel Memoir (English Edition)
- **가격**: $12.00
- A Journey through South America

## 🛠️ 설치 및 실행

### 사전 요구사항
- Node.js 18.0 이상
- pnpm (권장) 또는 npm

### 설치
```bash
# 저장소 클론
git clone https://github.com/your-username/nanuda-company.git
cd nanuda-company

# 의존성 설치
pnpm install
```

### 개발 서버 실행
```bash
pnpm dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 결과를 확인하세요.

### 빌드
```bash
# 프로덕션 빌드
pnpm build

# 프로덕션 서버 실행
pnpm start
```

### 린팅
```bash
pnpm lint
```

## 📁 프로젝트 구조

```
├── app/                    # Next.js App Router
│   ├── books/             # 도서 상세 페이지
│   ├── column/            # 블로그/칼럼 페이지
│   ├── globals.css        # 전역 스타일
│   ├── layout.tsx         # 루트 레이아웃
│   └── page.tsx           # 홈페이지
├── components/            # 재사용 가능한 컴포넌트
│   ├── ui/               # Shadcn/ui 컴포넌트
│   ├── blog-section.tsx
│   ├── books-section.tsx
│   ├── hero-section.tsx
│   └── ...
├── content/              # 마크다운 콘텐츠
│   └── blog/            # 블로그 포스트
├── hooks/               # 커스텀 React 훅
├── lib/                 # 유틸리티 함수 및 데이터
│   ├── books-data.ts    # 도서 데이터
│   ├── blog-data.ts     # 블로그 데이터
│   └── utils.ts         # 유틸리티 함수
├── public/              # 정적 파일
│   ├── images/          # 이미지 파일
│   └── book_preview/    # 도서 미리보기 이미지
└── styles/              # 추가 스타일 파일
```

## 🎨 디자인 시스템

### 색상 팔레트
- **Primary Dark**: `#1a1a1a` - 메인 배경색
- **Primary Orange**: `#D97706` - 브랜드 컬러
- **Text Light**: `#f5f5f5` - 메인 텍스트
- **Text Muted**: `#a3a3a3` - 보조 텍스트

### 타이포그래피
- **제목**: Inter 폰트 패밀리 사용
- **본문**: 시스템 기본 폰트 스택

## 🔧 환경 설정

### 환경 변수
프로젝트 루트에 `.env.local` 파일을 생성하고 필요한 환경 변수를 설정하세요:

```env
# Google Analytics (선택사항)
NEXT_PUBLIC_GA_ID=your-ga-id

# 기타 API 키들
NEXT_PUBLIC_API_KEY=your-api-key
```

## 📱 반응형 디자인

- **Mobile First**: 모바일 우선 디자인 접근
- **Breakpoints**:
  - `sm`: 640px 이상
  - `md`: 768px 이상
  - `lg`: 1024px 이상
  - `xl`: 1280px 이상

## 🔍 SEO 최적화

- **메타 태그**: 완전한 SEO 메타 태그 구성
- **Open Graph**: 소셜 미디어 공유 최적화
- **구조화된 데이터**: JSON-LD 스키마 마크업
- **사이트맵**: 자동 생성되는 XML 사이트맵

## 🚀 배포

### Vercel (권장)
```bash
# Vercel CLI 설치
npm i -g vercel

# 배포
vercel
```

### 기타 플랫폼
- **Netlify**: `pnpm build` 후 `out` 폴더 배포
- **AWS S3**: 정적 사이트 호스팅 설정 후 배포

## 🤝 기여하기

1. 이 저장소를 포크합니다
2. 새로운 기능 브랜치를 생성합니다 (`git checkout -b feature/amazing-feature`)
3. 변경사항을 커밋합니다 (`git commit -m 'Add some amazing feature'`)
4. 브랜치에 푸시합니다 (`git push origin feature/amazing-feature`)
5. Pull Request를 생성합니다

## 📄 라이선스

이 프로젝트는 [MIT 라이선스](LICENSE) 하에 배포됩니다.

## 📞 연락처

- **이메일**: contact@nanuda.co.kr
- **웹사이트**: [https://nanuda.co.kr](https://nanuda.co.kr)
- **인스타그램**: [@mindful_journey_one](https://www.instagram.com/mindful_journey_one/)

## 🙏 감사의 말

이 프로젝트는 다음 오픈소스 프로젝트들의 도움을 받았습니다:
- [Next.js](https://nextjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Shadcn/ui](https://ui.shadcn.com/)
- [Radix UI](https://www.radix-ui.com/)

---

**생각을나누다**에서 우리의 이야기가 누군가에게 영감의 씨앗이 되기를 바랍니다. 🌱 