// 자가출판 서비스 활성화 플래그.
// 결제(PG) 연동 전까지 프로덕션에서는 신청·주문 경로를 막고 "준비중"으로만 노출한다.
// Preview 환경에만 PUBLISH_ENABLED=true 를 넣어 내부 테스트를 계속한다.
export const PUBLISH_ENABLED = process.env.PUBLISH_ENABLED === "true"

/**
 * 주문·인쇄 접수 활성화 플래그. PUBLISH_ENABLED와 반드시 분리한다.
 *
 * 조판·표지 생성은 PDF를 만들 뿐이라 열어도 안전하지만, 주문은 결제 없이
 * 제작사에 인쇄를 접수시키고 우리 충전금이 빠져나간다. 플래그가 하나면
 * 스튜디오를 여는 순간 무료 인쇄 창구도 함께 열린다.
 */
export const PUBLISH_ORDERS_ENABLED = process.env.PUBLISH_ORDERS_ENABLED === "true"
