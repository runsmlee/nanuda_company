# Phase 2 설정 — 결제·DB 연결

코드는 준비되어 있고 아래 값만 채우면 동작합니다.

## 1. Supabase

1. 프로젝트 생성 (region은 `ap-northeast-2` 서울 권장)
2. SQL Editor에서 `supabase/migrations/0001_publishing.sql` 실행
3. Storage에서 **비공개** 버킷 `publishing-manuscripts` 생성 (Public 체크 해제)
4. Settings → API에서 아래 두 값 확보

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

> service role key는 RLS를 우회합니다. 서버 환경변수로만 두고 `NEXT_PUBLIC_` 접두사를 붙이지 마세요.

## 2. 레몬스퀴지

1. 스토어 생성 후 Settings → API에서 API 키 발급
2. 상품 2개 생성 후 각 **variant ID** 확보
   - 디지털: "인쇄용 PDF" — 조판 결과물
   - 실물: "실물 책" — 인쇄·배송
   - 가격은 체크아웃에서 `custom_price`로 덮어쓰므로 아무 값이나 두어도 됩니다
3. Settings → Webhooks에서 웹훅 등록
   - URL: `https://www.nanudacompany.com/api/publish/webhook/lemonsqueezy`
   - 이벤트: `order_created`, `order_refunded`
   - Signing secret: 임의 문자열 (6~40자)

```
LEMONSQUEEZY_API_KEY=...
LEMONSQUEEZY_STORE_ID=12345
LEMONSQUEEZY_WEBHOOK_SECRET=...
LEMONSQUEEZY_VARIANT_DIGITAL=...
LEMONSQUEEZY_VARIANT_PHYSICAL=...
PUBLISHING_DIGITAL_PRICE_KRW=19000
```

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
