// 자가출판 서비스 활성화 플래그.
// 결제(PG) 연동 전까지 프로덕션에서는 신청·주문 경로를 막고 "준비중"으로만 노출한다.
// Preview 환경에만 PUBLISH_ENABLED=true 를 넣어 내부 테스트를 계속한다.
export const PUBLISH_ENABLED = process.env.PUBLISH_ENABLED === "true"
