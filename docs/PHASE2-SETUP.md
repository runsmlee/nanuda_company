# Phase 2 설정 — 결제·DB 연결

코드는 준비되어 있고 아래 값만 채우면 동작합니다.

## 1. Supabase — 완료됨

프로젝트 `nanuda_company` (`edawvnjyupzmtuemxjgr`, ap-northeast-2)에 적용을 마쳤다.

- [x] 테이블 3종 (`publishing_projects` / `publishing_orders` / `publishing_webhook_events`)
- [x] 유니크 인덱스 — 결제 1건당 주문 1건, 제작사 주문 1건당 1회
- [x] RLS 전면 차단 (정책 없음 = service role만 통과)
- [x] 비공개 버킷 `publishing-manuscripts` (50MB 상한)
- [x] 트리거 함수 `search_path` 고정 (security advisor 경고 해소)

남은 것은 **service role key 한 개**다. MCP로는 노출되지 않으므로 대시보드에서 직접 가져와야 한다.

Settings → API → `service_role` 값을 `.env.local`에 넣는다 (이 파일은 gitignore 대상):

```
SUPABASE_URL=https://edawvnjyupzmtuemxjgr.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

> service role key는 RLS를 우회합니다. 서버 환경변수로만 두고 `NEXT_PUBLIC_` 접두사를 붙이지 마세요.

## 2. 레몬스퀴지 — 부분 완료

### 완료

- [x] API 키 `nanuda-publishing` 생성·검증 (`.env.local`에 저장)
- [x] 웹훅 서명 시크릿 생성
- [x] 통화 불일치 과청구 방지 가드 (`LEMONSQUEEZY_STORE_CURRENCY`)

### 대시보드에서 직접 해야 하는 것

레몬스퀴지 API는 **스토어와 상품 생성을 지원하지 않는다** (`POST /stores`, `POST /products` → 405).
대시보드에서만 가능하며, 인앱 브라우저에서는 대시보드 Vue 앱이 오류를 반복해
(`Cannot read properties of undefined (reading 'props')`) 국가 선택기가 로딩에서 멈춘다.
**일반 브라우저에서 진행할 것.**

**1) KRW 스토어 생성** — Settings → Stores → `+`

| 항목 | 값 |
|---|---|
| Store name | 생각을나누다 |
| Store URL | nanudacompany |
| Country | Korea, South |

생성 후 **Settings → General에서 통화를 KRW로** 설정한다. 이게 핵심이다 —
`custom_price`는 스토어 통화의 최소 단위로 해석되므로, USD 스토어에 원화 값을
보내면 13배 넘게 청구된다.

> 기존 WeeklyVentures(#277249)는 USD이고 다른 서비스 상품 10개가 운영 중이라
> 재사용하지 않는다.

**2) 상품 2개 생성** — Products → New Product

| 상품 | 용도 |
|---|---|
| 인쇄용 PDF | 디지털 — 조판 결과물 |
| 실물 책 | 실물 — 인쇄·배송 |

가격은 아무 값이나 둔다 (체크아웃에서 `custom_price`로 덮어씀).
생성 후 각 **variant ID**를 확인한다.

**3) 알려주실 값**

```
새 스토어 ID
variant ID (디지털)
variant ID (실물)
```

이 세 개만 주시면 나머지(웹훅 등록, 테스트 결제, 멱등성 검증)는 API로 처리한다.
`POST /webhooks`와 `POST /checkouts`는 API로 가능함을 확인했다.

## 3. 활성화

```
PUBLISH_ENABLED=true
```

Preview 환경에만 넣어 내부 테스트를 먼저 합니다. 프로덕션은 실제 판매 시작 시점에 켭니다.

## 검증 순서

1. `node lib/publishing/payment.test.mjs` — 웹훅 서명 검증 (계정 없이 가능, 통과 확인됨)
2. 레몬스퀴지 **테스트 모드**로 체크아웃 → 결제 → 웹훅 수신 확인
3. `publishing_orders`에서 `status`가 `pending → paid → submitted`로 가는지 확인
4. SweetBook 샌드박스에 주문이 생겼는지 확인
5. 같은 웹훅을 대시보드에서 재전송 → 주문이 하나만 유지되는지 확인 (멱등성)

## 알려진 주의점

- **레몬스퀴지 약관상 실물 상품은 금지 목록 1번**입니다. 디지털(조판 서비스)은 문제없고, 실물 라인은 위험을 안고 시작하는 결정입니다. `LineKind`로 분리해 두었으니 필요 시 실물만 국내 PG로 옮기면 됩니다.
- 레몬스퀴지는 Stripe 인수 후 유지보수 모드이며 Stripe Managed Payments로 이전을 유도하고 있습니다.
- 체크아웃은 항목 하나만 지원합니다. 디지털+실물 동시 구매가 필요해지면 결제를 나누거나 묶음 variant가 필요합니다.
