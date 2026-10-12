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
   같은 인증으로 `POST /api/publish/reconcile?check=1`을 호출하면 주문 생성·환불·DB 수정 없이 배포된 서버의 결제 스토어, 상품, 환경, 제작사 접근, DB 스키마를 확인한다. 제작사는 공개 카탈로그 200만으로 인증을 판정하지 않고, 인증 필수 `GET /credits`에서 키의 test/live 환경과 KRW를 검증한다. 단가가 비어 있거나 0이면 결제를 만들지 않는다. 키·잔액·고객정보는 반환하지 않는다.
7. 내부 테스트 환경에서 성공, 거절·이탈 후 동일 주문 재시도, 중복 웹훅, 제작 실패 후 복구, 일부·전액 환불과 조회 권한을 확인한다. 실제 운영 키로 주문 생성부터 취소·환불까지 별도 통제된 검증을 마친 뒤 신규 접수를 연다. 코드 테스트를 실결제 검증으로 간주하지 않는다.

기존 Supabase 주문, PostgreSQL 함수, GitHub Actions와 제작사 멱등키를 사용한다. 주문 저장 전 관측은 별도 시도 테이블을 사용한다. 복구 대기량이나 순환 대조 시간이 운영 목표를 넘으면 워커 처리량·스케줄을 확장한다.

## 주문 저장 전 결제 시도 관측

`20261012034625_publishing_checkout_observability.sql`을 먼저 적용한 뒤 서버를 배포한다. `publishing_checkout_attempts`는 주문과 독립적이며 요청 수신 시 생성된다. 형식 검사, 옵션·원고·이메일·배송지 검사, 설정, 제작사, 파싱, 조판, 표지, 프로젝트·주문 저장, 결제사, 견적 저장 단계를 기록한다. `ready`는 결제창 준비 완료이며 결제 성공을 뜻하지 않는다. 결제 여부는 기존 결제 원장으로 확인한다.

각 HTTP 요청은 서버 생성 `id`를 가지며, 같은 주문 재시도는 검증된 `attempt_id`로 연결한다. 응답 헤더 `X-Checkout-Request-Id`로 오류를 대조할 수 있다. 기록 필드는 시각, UUID, 단계, 결과, HTTP 상태, 처리 시간, 배포 환경, test/live·QA 여부로 제한한다. 이메일·IP·브라우저 정보·원고·파일명·배송지·URL·토큰·자유 형식 오류 메시지는 저장하지 않는다. RLS와 권한 회수로 공개 API 접근을 막고 서버 service role만 읽고 쓴다. 이 기록은 서버 로그 보존 기간과 독립적으로 축적하며 현재 자동 삭제하지 않는다.

기존 10분 간격 workflow가 운영 live 기록을 함께 점검한다. 미확인 5xx 실패, 기록 저장 장애, 5분 이상 완료되지 않은 요청, 15분 내 입력 거절 10건 이상은 HTTP 409와 실패한 Actions 실행으로 표시한다. workflow 로그는 응답 요약을 출력한다. GitHub의 Actions 알림 수신 여부는 계정의 알림 설정에 따른다. 단일 입력 오류는 기록하되 경보를 만들지 않는다. preview·test 및 워커 Bearer 인증과 `X-Checkout-Probe: 1`이 모두 유효한 QA 요청은 운영 경보에서 제외한다. 클라이언트가 헤더만 보내서는 QA가 되지 않는다.

인증된 `POST /api/publish/reconcile?monitor=1`은 주문 처리 없이 시도 집계와 확인 대상 최대 20건을 조회한다. `?check=1`은 관측 스키마 접근도 검증한다. 문제가 해결되면 해당 요청의 원인을 확인한 뒤 운영자가 `reviewed_at`을 기록한다. 전체 기록과 실패 결과는 보존한다:

```sql
select public.publishing_checkout_monitor();
select id, attempt_id, order_id, created_at, stage, outcome, http_status, duration_ms
from public.publishing_checkout_attempts
where created_at >= now() - interval '3 months'
order by created_at desc;
-- 실제 확인한 요청 UUID만 지정한다.
update public.publishing_checkout_attempts set reviewed_at = now() where id = '<확인한 요청 UUID>'::uuid;
```

기록 장애는 2초에 중단하고 최종 응답 때 한 번 다시 시도한다. 정상 결제를 로그 저장 때문에 실패시키지 않으며, 복구 시 `persistence_failed`를 보존한다. DB 자체가 완전히 중단되면 상세 기록을 남기지 못할 수 있으며 정기 점검 실패로 감지한다. 서버에 도착하지 않은 브라우저 네트워크 오류와 결제사 화면에서의 카드 거절·이탈은 이 서버 관측만으로 확인할 수 없다. 과거 누락 시도를 소급 복원하지 않는다.

## 원고 보존 기한

`/privacy`에 적은 보존 기간을 정산 작업(`POST /api/publish/reconcile`)이 실행될 때마다 최대 20건씩 처리한다. 원고·표지 파일과 뒤표지 글만 지우고, 주문·결제·배송 기록은 전자상거래법 보관 기간 동안 그대로 둔다. 판정은 `publishing_order_files_releasable`, 처리는 `publishing_claim_file_purge`(`20261012060000_publishing_file_retention.sql`)가 한다.

- 미결제: 결제 링크 만료 1일 뒤. 만료 직후 도착한 결제는 확인 대상으로 보류되므로 파일이 없어도 인쇄되지 않는다.
- 전액 환불: 인쇄 취소가 확인(`cancelled`)되었거나 인쇄 전(`not_started`)일 때.
- 배송: 제작사 상태에서 배송 완료를 처음 관측한 시점부터 3개월. 배송 완료 이벤트가 없으면 발송 관측 시점 + 14일부터 3개월.
- 주문 없이 남은 프로젝트(결제 준비 중 실패): 생성 1일 뒤.
- 확인 대상(`review_required`)이거나 진행 중인 주문의 파일은 지우지 않는다. 확인을 마치고 보류를 풀면 다음 실행에서 처리된다.

프로젝트를 먼저 `files_purged_at`으로 잠근 뒤 스토리지를 지우고 경로를 비운다. 스토리지 삭제가 실패하면 경로가 남아 다음 실행에서 다시 시도되고, 정산 응답이 500이 되어 알림이 간다. 잠긴 프로젝트로 결제를 다시 시도하면 새 주문 요청을 안내한다.

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
