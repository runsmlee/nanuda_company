# 나누다컴퍼니 자가출판 서비스 설계

## 목적

나누다컴퍼니가 보유한 출판사 자격을 기반으로, 다른 사람의 원고를 책으로 만들어주는 자가출판 서비스를 웹사이트에 붙인다.

1차 목표는 **제작(인쇄용 PDF → 인쇄 → 배송)** 까지다. ISBN 발급과 온라인 서점 유통은 이 문서의 범위에 포함하지 않고 후속 단계로 분리한다.

## 설계 원칙 (우선순위 순)

1. **최고의 UI/UX가 최우선이다.** 자가출판 신청은 저자에게 감정적으로 큰 행위다. 신청 흐름의 모든 화면은 기존 사이트의 디자인 언어(다크 `#1a1a1a`, 오렌지 `#ff6b35`, 명조 디스플레이 타이포그래피, 넉넉한 여백)를 따르고, 각 단계에서 지금 무슨 일이 일어나는지·다음에 무엇을 해야 하는지가 항상 명확해야 한다. 기능이 같다면 더 좋은 경험 쪽을 택한다.
2. 외부 제작사 API에 코드를 직접 결합하지 않는다. 내부 도메인 모델과 제작사 어댑터를 분리한다.
3. 결제·인쇄가 얽힌 경로는 멱등성과 명시적 상태 전이로 보호한다.

## 전제와 확인된 사실

**사이트 전제**

- 나누다컴퍼니는 출판사 신고가 완료되어 있다. (ISBN 발행자번호 확보 가능)
- 현재 사이트는 Next.js 15 App Router + Vercel 기반이며, 이번 작업 전까지 DB·인증·파일 업로드·API 라우트가 전혀 없는 정적 콘텐츠 사이트였다.

**SweetBook "Book Print API" — Sandbox 실측으로 확인 (2026-07-25)**

당초 `api.sweetbook.com`이 403을 반환해 미확인이었으나, 샌드박스 키 발급 후 전체 스펙을 확인했다. 개발문서는 `https://api.sweetbook.com/docs` (AI 에이전트용 `docs/llms-full.txt` 제공).

- Base URL: `https://api-sandbox.sweetbook.com/v1` (Sandbox) / `https://api.sweetbook.com/v1` (Live). 키의 환경과 도메인이 일치해야 한다 (`ERR_ENV_MISMATCH`).
- 인증: `Authorization: Bearer {API_KEY}`
- 결제 모델: **충전금(선불 크레딧)**. 주문 생성 시 즉시 차감. Sandbox는 `POST /credits/sandbox/charge`로 테스트 충전.
- 핵심 흐름 (PDF 업로드 방식): `POST /books` → `POST /books/{uid}/pdf-cover` → `POST /books/{uid}/pdf-contents` → `POST /books/{uid}/finalization` → `POST /orders/estimate` → `POST /orders`
- 멱등성: `POST /books`, `POST /orders`가 `Idempotency-Key` 헤더 지원. 동일 키 + 다른 본문은 422.
- 주문 상태: `PAID → PDF_READY → CONFIRMED → IN_PRODUCTION → COMPLETED → PRODUCTION_COMPLETE → SHIPPED → DELIVERED`, 취소는 `CANCELLED` / `CANCELLED_REFUND`. 취소는 `PAID`/`PDF_READY`에서만 가능하고 충전금으로 전액 환불된다.
- 웹훅 제공 (`order.created`, `production.*`, `shipping.*`). 폴링도 가능.
- PDF 검증은 업로드 시점에 동기 수행: 페이지 수 일치, 판형별 mm 규격(±1mm 톨러런스). **CMYK/PDF-X 요구 없음** — 색공간 제약이 검증 항목에 없어, 당초 우려한 RGB→CMYK 변환 파이프라인은 불필요하다.
- 판형(실측, sandbox 단가):

| bookSpecUid | 판형 | 페이지 | 기본가(KRW) | 추가(2p당) |
|---|---|---|---|---|
| `PHOTOBOOK_A5_SC` | A5 소프트커버 (148×210) | 50~200 | 11,900 | 200 |
| `PHOTOBOOK_A4_SC` | A4 소프트커버 (210×297) | 24~130 | 12,400 | 400 |
| `SQUAREBOOK_SC` | 스퀘어 소프트커버 (243×248) | 24~130 | 10,800 | — |
| `SQUAREBOOK_HC` | 스퀘어 하드커버 (243×248) | 24~130 | 12,600 | 280 |

- PDF 규격 공식 (소프트커버): 내지 `w=trim+6mm, h=trim+6mm` (도련 3mm), 표지 `w=(trim폭×2)+6+책등, h=trim높이+6`, 책등 `=1.0+(0.054×페이지수)`. 배송비 3,000원/주문.

**남은 미확인 사항**

- 글 위주 단행본에 맞는 전용 판형 부재 — 현재 4종 모두 포토북 계열(내지 90~130g 사진 용지). A5 소프트커버(최대 200p)가 가장 근접하지만, 200p 초과 원고와 흑백 내지 단가(현재 컬러 단일가)는 협의 필요.
- Live 전환 조건: 사업 협의 → 커스텀 가격 결정 → Live 키 발급 절차 필요 (파트너 여정에 명시됨).

## 단계 구분

| 단계 | 내용 | 상태 |
|---|---|---|
| **Phase 0** | `/publish` 소개 + 인쇄용 PDF 업로드 → 검증 → 견적 → 샌드박스 주문 → 상태 추적. DB·로그인 없음 | **구현됨 (이 PR)** |
| **Phase 1** | 원고(.docx/.md) 접수 + 운영자 조판 워크플로우, 저자 결제(PG), 프로젝트 DB | 대기 |
| **Phase 2** | Live 키 전환, 웹훅 수신, 자동 알림 | 대기 |
| **Phase 3** | ISBN 발급, 온라인 서점 유통 | 범위 외 |

Phase 0은 "인쇄용 PDF를 이미 가진 사용자"(직접 제작 또는 운영자가 조판해준 파일)를 대상으로 전체 파이프라인을 실작동시킨다. 임의 원고의 자동 조판(당초 Phase 1)은 가장 비싼 항목이므로, **월 신청량이 수동 조판 한계를 넘을 때** 착수한다.

## 사용자 경험 (Phase 0)

1. `/publish` — 서비스 소개, 판형·가격 안내(살아있는 단가로 표시), 제작 과정 안내.
2. `/publish/start` — 4단계 위저드:
   - **판형 선택**: 판형 카드에서 선택, 페이지 수 입력 → 예상 가격 즉시 표시
   - **책 정보 + PDF 업로드**: 제목·저자명, 표지/내지 PDF 업로드. 요구 규격(mm)을 화면에 계산해서 보여준다
   - **검증 + 견적**: SweetBook 동기 검증 결과(성공/실패 사유)를 그대로 보여주고, 확정 견적 제시
   - **배송지 + 주문**: 배송 정보 입력 → 주문 생성 → 주문번호 발급
3. `/publish/orders/[orderUid]` — 상태 타임라인(결제완료 → 제작확정 → 제작중 → 발송 → 배송완료). 주문번호만 알면 조회 가능.

실패는 단계 안에서 복구한다: PDF 규격 불일치 시 SweetBook의 측정값·허용 규격 메시지를 그대로 노출하고 해당 단계에서 재업로드하게 한다.

## 기술 설계

### 아키텍처 (Phase 0)

```
저자 ─ /publish/* (Next.js, 기존 디자인 시스템)
         │
         └─ app/api/publish/* (Route Handlers, 서버 전용)
                 │  SWEETBOOK_API_KEY는 서버 env에만 존재
                 └─ lib/publishing/sweetbook.ts (제작사 어댑터)
                         └─ SweetBook Sandbox API
```

- **Phase 0에는 자체 DB가 없다.** 책·주문·상태의 원천 저장소는 SweetBook이며, `externalRef`에 우리 식별자를 심어 추적한다. 프로젝트 관리(원고 접수, 교정 왕복, 저자 계정)가 필요해지는 Phase 1에서 Postgres(Supabase 또는 Vercel Marketplace 경유 Neon)를 도입한다. ~~Vercel Postgres~~는 단종되어 선택지가 아니다.
- API 키는 `SWEETBOOK_API_KEY` 서버 환경변수로만 접근한다. 클라이언트 번들에 포함되지 않는다 (`NEXT_PUBLIC_` 금지).

### 제작사 어댑터

`lib/publishing/sweetbook.ts` 한 파일에 SweetBook 필드 매핑을 격리한다. 스펙이 실측으로 확정됐으므로 당초 계획의 `MockProvider`는 만들지 않는다 — **Sandbox 환경 자체가 테스트 대역**이다. 다른 제작사(교보 바로출판 POD 등)를 붙일 때 인터페이스 추출을 그때 한다.

당초 설계의 `quote()`는 SweetBook의 실제 엔드포인트 `POST /orders/estimate`로 대응된다 (잔액 충분 여부 `creditSufficient`까지 반환).

### 상태 모델

Phase 0은 SweetBook의 주문 상태를 그대로 사용한다 (자체 상태 기계 없음). UI 분기는 `orderStatus` enum, 표시는 `orderStatusDisplay` 한글 문자열.

Phase 1에서 프로젝트 DB를 도입할 때의 내부 상태 기계(당초 설계 갱신):

```
draft → manuscript_review → typesetting ⇄ proof_ready → quoted → paid
      → print_submitted → (SweetBook 상태 미러링) → delivered
비정상 경로: rejected(콘텐츠 거절) / cancelled(결제 전 취소)
           / refunded(결제 후 취소·환불) / failed(운영자 개입)
```

- `proof_ready ⇄ typesetting` 역방향 전이(교정 왕복)를 명시한다 — 실무에서 가장 자주 밟는 경로다.
- `cancelled`·`refunded`를 정식 상태로 둔다. 전자상거래법상 청약철회 경로가 화이트리스트에 존재해야 한다. SweetBook 쪽 취소는 `PAID`/`PDF_READY`까지만 가능하므로, 우리 환불 정책도 "제작확정 전까지"로 정렬한다.

### 결제와 정합성

- **저자 → 나누다**: Phase 1에서 국내 PG(토스페이먼츠 또는 포트원) 연동. **나누다 → SweetBook**: 충전금 선차감. 두 결제가 분리되어 있으므로, 저자 결제 성공 후 SweetBook 주문 실패 시 충전금은 차감되지 않고(주문 자체가 실패) 저자 환불만 처리하면 된다 — 당초 우려한 이중 정산 경로가 구조적으로 단순해진다.
- `POST /orders` 멱등키는 위저드가 주문 단계에 진입할 때 클라이언트에서 생성해 재시도 간 유지한다. 이중 인쇄·이중 청구 방지.
- 주문 전 `POST /orders/estimate`로 금액·잔액을 사전 검증한다. 402(`ERR_INSUFFICIENT_CREDIT`) 시 운영자에게 충전 필요를 알린다.
- 상태 추적은 폴링 기본, 웹훅은 Phase 2에서 추가 (스펙 확인됨: `production.*`, `shipping.*`).

### 파일 취급

- Phase 0에서 PDF는 서버를 경유해 SweetBook으로 즉시 전달되며 우리 스토리지에 저장하지 않는다.
- **알려진 제약**: Vercel 배포 시 Route Handler 요청 본문 한도(~4.5MB)로 대용량 PDF 업로드가 실패한다. 로컬/데모에는 문제없고, 운영 전환 시 Vercel Blob 직접 업로드(presigned)로 우회한다. Phase 1에서 원고를 자체 보관하게 되면 비공개 버킷 + 만료 서명 URL 원칙을 적용한다.
- 원고·PDF 본문이 로그·에러 리포트에 남지 않도록 한다.

### 라우팅과 기존 사이트 영향

- 신규: `/publish`(색인 대상), `/publish/start`·`/publish/orders/[orderUid]`(`noindex`), `app/api/publish/*`.
- `app/sitemap.ts`에는 `/publish`만 추가한다.
- `pnpm check:llms` 게이트는 `content/book-reader`만 스캔하므로 영향 없음 — 빌드로 확인한다.
- 기존 책 상세/리더 라우팅, SEO, JSON-LD는 건드리지 않는다.

### 정책과 법무 (Phase 1 착수 전 확정)

- 원고 저작권은 저자에게 있음을 약관에 명시하고, 이용 목적을 제작 범위로 한정한다.
- 불법 콘텐츠·표절·명예훼손·타인 개인정보 포함 원고에 대한 거절권을 명문화한다 (`rejected` 상태).
- 개인정보처리방침에 배송지 정보의 보관 기간·위탁(제작사·PG) 사실을 추가한다.
- 나누다컴퍼니 브랜드로 나가는 책의 최소 품질·내용 기준을 정한다.

## 검증 기준 (Phase 0)

- `pnpm build` 와 `pnpm check:llms` 가 통과한다.
- Sandbox에서 실제로: 책 생성 → 표지/내지 PDF 업로드(동기 검증 통과) → 최종화 → 견적 → 주문 생성 → 주문 조회까지 전체 흐름이 성공한다.
- 규격 불일치 PDF 업로드 시 SweetBook 검증 에러가 사용자에게 이유와 함께 표시된다.
- 동일 멱등키로 주문을 재시도해도 주문이 하나만 생성된다.
- `/publish/start` 와 `/publish/orders/*` 가 `noindex` 이며 sitemap에 없다. `/publish`는 sitemap에 있다.
- API 키가 클라이언트 번들·저장소에 노출되지 않는다.
- 기존 라우트의 SEO 메타데이터가 변경되지 않는다.

## SweetBook 협의 필요 항목 (Live 전환 전)

당초 8개 확인 항목 중 6개는 샌드박스 실측으로 해소됐다. 남은 것:

1. 글 위주 단행본 조건 — 200p 초과, 흑백 내지 단가, 본문용 경량 용지 옵션
2. Live 커스텀 가격·정산 조건, 제작 리드타임, 불량·재인쇄 정책

## 후속 옵션

Phase 3 에서 유통을 붙일 경우, 나누다컴퍼니가 출판사 자격으로 직접 처리할 수 있다.

- ISBN: 국립중앙도서관 서지정보유통지원시스템에서 책마다 발급. 전산 신청이 가능해 부분 자동화 여지가 있다.
- 서점 등록: 예스24·교보·알라딘 직접 공급계약(전자계약·공동인증서 필요) 또는 유통 총판 1곳 경유. 초기에는 총판 경유가 운영 부담이 적다.
- 서점 상품 등록은 공개 개발자 API 대신 공급사 포털·일괄 업로드 방식일 가능성이 높다. 등록·정산·CS 는 사람 운영이 필요한 영역으로 남는다.
