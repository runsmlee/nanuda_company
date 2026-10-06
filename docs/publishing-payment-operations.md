# 결제 운영과 배포

이 문서는 결제 안정성 수정의 배포·복구 절차다. 결제사의 실물 상품 취급 여부 검토는 이번 범위에서 제외했다.

## 배포 순서

1. 신규 접수를 잠시 닫는다 (`PUBLISH_ENABLED=false`). 기존 주문의 토큰 조회는 이 플래그와 관계없이 유지된다.
2. `supabase/migrations/0002_payment_reliability.sql`, `20261006225307_payment_refund_rounding.sql`을 순서대로 적용한다. 기존 행을 삭제하거나 자동 재제작하지 않는 추가 마이그레이션이다. 새 서버 코드는 이 마이그레이션을 필요로 한다.
3. `PUBLISH_WORKER_SECRET`을 32자 이상의 무작위 값으로 생성해 Vercel 서버 환경과 GitHub Actions repository secret에 같은 값을 설정한다. 노출되는 `NEXT_PUBLIC_*` 환경변수로 만들지 않는다.
4. 결제·제작 환경을 맞춘다. 운영은 `LEMONSQUEEZY_TEST_MODE=false`와 `SWEETBOOK_API_BASE=https://api.sweetbook.com/v1`, 테스트는 `true`와 `https://api-sandbox.sweetbook.com/v1`이다. 각각 해당 환경의 유효한 API 키, store/variant, `KRW` 통화와 웹훅 서명이 필요하다. 워커 secret이나 환경 짝이 없으면 새 결제를 만들지 않는다.
5. 새 코드를 배포하고 기존 주문을 먼저 읽기 전용으로 대조한다:

   ```bash
   pnpm exec tsx --env-file=.env.local scripts/backfill-publishing-payments.ts
   ```

   확인한 환경의 서버 자격 증명을 사용해야 한다. 기본 실행은 결제사 GET과 DB SELECT만 한다. 대조 결과를 검토한 뒤 같은 명령에 `--apply`를 추가해 검증 정보와 실제 결제·환불액을 채운다. 인쇄 주문은 만들지 않는다. 확인 불가능한 결제, 결제 ID가 없는 기존 환불, 접수되지 않은 기존 결제는 운영 확인 대상으로 보존한다. 소유권·금액이 확인되기 전에는 기존 실패 주문의 보류를 풀지 않는다.
6. `Publishing payment reconciliation` workflow를 수동 실행해 인증·DB·실제 API 접근을 확인한다. 기본 스케줄은 10분이며 GitHub 지연이 있을 수 있다. 한 번에 제작 대기 주문 하나를 처리하거나 기존 접수 주문 하나를 순환 대조한다. 정상 신규 결제는 웹훅 직후 바로 처리하며 이 스케줄은 복구 경로다.
   같은 인증으로 `POST /api/publish/reconcile?check=1`을 호출하면 주문 생성·환불·DB 수정 없이 배포된 서버의 결제 스토어, 상품, 환경, 제작사 접근, DB 스키마를 확인한다. 키나 고객정보는 반환하지 않는다.
7. 내부 테스트 환경에서 성공, 거절·이탈 후 동일 주문 재시도, 중복 웹훅, 제작 실패 후 복구, 일부·전액 환불과 조회 권한을 확인한다. 실제 운영 키로 주문 생성부터 취소·환불까지 별도 통제된 검증을 마친 뒤 신규 접수를 연다. 코드 테스트를 실결제 검증으로 간주하지 않는다.

새 테이블·작업 큐 서비스·고객 계정 시스템은 추가하지 않았다. 기존 Supabase 주문, PostgreSQL 함수, GitHub Actions와 제작사 멱등키를 사용한다. 복구 대기량이나 순환 대조 시간이 운영 목표를 넘으면 워커 처리량·스케줄을 확장한다.

## 운영 확인 대상

인증된 `POST /api/publish/reconcile` 응답은 확인이 필요한 주문번호, 사유, 취소 상태를 반환한다. 확인 대상이 있으면 HTTP 409로 workflow를 실패시켜 문제가 정상 실행으로 묻히지 않게 한다. 작업자가 실제 실패 알림을 받는지도 배포 검증에 포함한다.

- 제작사 일시 장애: 지연 재시도, 최대 5회. 같은 인쇄 요청을 같은 멱등키로 복원한다.
- 충전금 부족·유효하지 않은 설정·변경된 제작 견적: 자동 접수를 보류한다. 운영자가 원인을 해결하고 결제·인쇄 원장을 대조한 뒤 재시도 여부를 결정한다.
- 청구액 불일치·추가 결제·다른 주문에 연결된 결제: 금액과 오류를 보존하고 자동 제작을 막는다. 결제사 주문을 확인해 환불 또는 잔액 정리를 수행한다. 새로운 결제를 사용자에게 요청하지 않는다.
- 일부 환불: 누적 환불액을 보존하고 미접수 제작을 보류한다. 전액 환불과 구분한다.
- 결제사가 전액 환불을 명시했을 때만 원 결제액과 1원 이내의 환전 반올림 차이를 허용한다. 실제 반환된 환불액을 그대로 보존한다. 전액 환불 표시가 없거나 더 큰 차이는 보류한다.
- 전액 환불: `PAID`/`PDF_READY` 인쇄 주문에 취소 요청을 보내고 조회로 확인한다. 이미 제작 확정 이후라 취소할 수 없으면 `needs_review`로 남긴다. 고객 결제 환불과 제작사 충전금 반환을 서로 대신 처리한 것으로 보지 않는다.
- 인쇄 주문 생성 응답이나 DB 저장이 유실된 경우: 저장한 인쇄 요청으로 같은 멱등키를 조회·복원해 환불 시 취소한다. 제작사 키 보존 기간이 24시간이므로 23시간을 넘은 불확실한 요청은 재생성하지 않고 직접 대조한다.
- 제작사에서 유료 주문이 취소·오류 상태가 된 경우: 고객 결제의 환불·복구 여부를 확인 대상으로 올린다.

기존 고객의 예전 토큰 없는 링크는 개인정보를 보여주지 않고 조회 문의 화면을 표시한다. 결제 이메일/영수증으로 소유권을 확인한 뒤 해당 프로젝트 토큰의 새 주문 링크를 제공한다. 조회 토큰을 로그·분석·공개 문서에 복사하지 않는다.

## 검증 명령

```bash
bash scripts/test-publishing-payments.sh
pnpm exec tsx --test lib/publishing/payment.test.mjs lib/publishing/webhook-guard.test.mjs lib/publishing/pricing.test.mjs lib/publishing/sweetbook-webhook.test.mjs lib/publishing/typeset.test.mjs
pnpm exec tsc --noEmit
pnpm build
```

통합 테스트는 `initdb`, `pg_ctl`, `psql`, `createdb`가 있는 로컬 PostgreSQL에서 별도 임시 인스턴스를 만들고 실제 마이그레이션과 코드에 연결한다. 포트 55439가 이미 사용 중이면 기존 DB를 건드리지 않고 중단한다. 제작·결제 API는 테스트 응답만 사용하며 미등록 외부 요청은 차단한다. 개발 서버와 production build가 같은 `.next`를 동시에 쓰지 않도록 개발 서버를 중단하고 빌드한다.

실제 샌드박스 API 검증은 `bash scripts/test-publishing-payments.sh --sandbox <새 QA 결제 ID>`로 실행한다. 이 경로는 제작사 샌드박스 주문을 만들고 QA 결제에 일부·전액 환불을 실행한다. 결제는 24시간 이내 생성된 `payment-qa@example.com` 테스트 주문만 허용하며, 앱 DB 기록은 별도 임시 PostgreSQL에만 쓴다. 실제 카드와 운영 결제를 사용하지 않는다.

## API 근거

Lemon Squeezy의 [checkout API](https://docs.lemonsqueezy.com/api/checkouts/create-checkout)는 mode, 만료, 허용 variant, 영수증 링크와 할인 입력 설정을 지원한다. [주문 API](https://docs.lemonsqueezy.com/api/orders/the-order-object)의 실제 청구·누적 환불액을 저장하며, [환불 웹훅](https://docs.lemonsqueezy.com/help/webhooks/event-types)은 일부·전액 환불 모두 전달한다. 제작사 취소 가능 상태와 24시간 멱등성 보존 기간은 저장된 `docs/vendor/sweetbook-llms-full.txt`의 주문·멱등성 절을 따른다.
