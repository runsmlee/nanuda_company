# 나누다컴퍼니 PWA 설치 기능 설계

## 목적

나누다컴퍼니 웹사이트를 사용자가 휴대폰이나 데스크톱에서 앱처럼 설치하고 바로 열 수 있게 만든다. 1차 목표는 App Store/Play Store 앱 출시가 아니라, 웹 표준 PWA 메타데이터를 통해 홈 화면 아이콘과 standalone 실행 경험을 제공하는 것이다.

## 사용자 경험

- Android Chrome과 데스크톱 Chrome 계열 브라우저에서 설치 가능한 웹앱으로 인식된다.
- iPhone/iPad에서는 Safari의 "홈 화면에 추가"를 통해 앱 아이콘처럼 열 수 있다.
- 홈 화면 아이콘으로 실행하면 가능한 브라우저 UI를 줄인 standalone 모드로 열린다.
- 앱 이름은 긴 이름 `생각을나누다 - 나누다컴퍼니`, 짧은 이름 `생각을나누다`를 사용한다.

## 구현 범위

### 1차 MVP

- Next.js App Router의 `app/manifest.ts`를 추가한다.
- `app/layout.tsx`의 metadata에 PWA/Apple Web App 관련 값을 추가한다.
- 기존 square favicon artwork를 바탕으로 PNG 앱 아이콘을 생성한다.
- `theme-color`, `background_color`, `display`, `start_url`, `scope`, `lang`, `categories`를 명시한다.
- 기존 SEO, JSON-LD, 책 상세/리더 라우팅, Naver verification 파일은 변경하지 않는다.

### 제외 범위

- 네이티브 앱 패키징(Capacitor, React Native, App Store/Play Store 배포)
- Push notification
- 오프라인 책 리더 캐싱
- 설치 유도 팝업 UI
- 서비스 워커 기반 runtime cache

## 기술 설계

### Manifest

`app/manifest.ts`에서 `MetadataRoute.Manifest`를 반환한다.

주요 값:

- `id`: `/`
- `start_url`: `/`
- `scope`: `/`
- `display`: `standalone`
- `background_color`: `#242424`
- `theme_color`: `#D97706`
- `lang`: `ko-KR`
- `icons`: 192, 512, maskable 512 PNG

### Metadata

`app/layout.tsx`의 `metadata`에 다음 항목을 추가한다.

- `manifest: "/manifest.webmanifest"`
- `appleWebApp`: capable/title/statusBarStyle
- `icons`: favicon SVG와 Apple touch icon PNG

기존 `<head>`의 명시적인 favicon/apple-touch/theme-color 링크는 compatibility 목적으로 유지하되, Apple touch icon은 새 PNG 아이콘으로 교체한다.

### Icons

기존 `public/images/favicon.svg`는 정사각형 artwork라서 PWA 아이콘 원본으로 적합하다. 다음 파일을 생성한다.

- `public/icons/icon-192x192.png`
- `public/icons/icon-512x512.png`
- `public/icons/maskable-icon-512x512.png`
- `public/icons/apple-touch-icon.png`

## 검증 기준

- `pnpm build`가 통과한다.
- `/manifest.webmanifest`가 유효한 JSON으로 렌더링된다.
- manifest가 192x192, 512x512 아이콘을 참조한다.
- 생성된 PNG 아이콘 파일이 실제 PNG이며 올바른 크기다.
- 기존 `pnpm check:llms` build gate가 계속 통과한다.

## 후속 옵션

오프라인 열람까지 필요해지면 별도 작업으로 서비스 워커를 추가한다. 이때 책 리더 이미지와 공개 텍스트의 캐싱 범위를 분리하고, 검색/SEO 메타데이터가 오래 캐시되지 않도록 navigation은 network-first 또는 no-cache 정책을 적용해야 한다.
