import Link from "next/link"
import { BUSINESS, LegalPage, legalMetadata, Section } from "@/components/legal-page"

export const metadata = legalMetadata(
  "/refund",
  "취소·환불 정책",
  "생각을나누다 자가출판 인쇄 주문의 취소 가능 시점, 제작 하자 처리, 환불 방법과 기간을 안내합니다.",
)

export default function RefundPage() {
  return (
    <LegalPage path="/refund" title="취소·환불 정책">
      <p className="text-text-gray leading-relaxed">
        이 정책은 {BUSINESS.name}(이하 &ldquo;회사&rdquo;)가 운영하는 자가출판 인쇄 서비스의 주문 취소와 환불
        기준입니다. 이 사이트에서 소개하는 출간 도서를 외부 서점(네이버쇼핑, Amazon 등)에서 구매한 경우에는 해당
        판매처의 정책이 적용됩니다.
      </p>

      <Section title="1. 주문제작 상품의 특성">
        <p>
          자가출판 서비스의 책은 이용자가 올린 원고와 선택한 판형·표지로 주문마다 한 권씩 따로 만드는{" "}
          <strong>주문제작 상품</strong>입니다. 따라서 「전자상거래 등에서의 소비자보호에 관한 법률」 제17조 제2항
          제5호에 따라, 제작이 확정된 뒤에는 단순 변심에 의한 청약철회가 제한됩니다.
        </p>
        <p>
          이용자는 결제 전에 조판된 본문과 표지를 미리보기로 확인하고, 판형·쪽수·수량·금액·배송지를 확인한 뒤
          주문합니다.
        </p>
      </Section>

      <Section title="2. 제작 확정 전 취소: 전액 환불">
        <p>
          주문 조회 화면의 진행 단계가 <strong>&lsquo;결제 완료&rsquo;</strong>로 표시되는 동안에는 이유와 관계없이
          주문을 취소할 수 있습니다. 주문번호와 결제한 이메일 주소를 적어{" "}
          <a href={`mailto:${BUSINESS.email}`} className="text-white underline underline-offset-4">
            {BUSINESS.email}
          </a>
          로 요청해 주세요. 회사는 인쇄 주문을 취소하고 배송비를 포함한 결제 금액 전액을 환불합니다.
        </p>
        <p>
          결제를 마치지 않았거나 결제 페이지가 만료된 주문은 청구되지 않으며, 별도의 취소 절차가 필요하지 않습니다.
        </p>
      </Section>

      <Section title="3. 제작 확정 이후">
        <p>
          진행 단계가 <strong>&lsquo;제작 확정&rsquo;</strong> 이후로 바뀌면 인쇄 일정이 배정되어 제작이 시작됩니다.
          이때부터는 단순 변심, 원고 수정, 판형·수량 변경을 이유로 주문을 취소하거나 환불받을 수 없습니다.
        </p>
        <p>다음은 제작 하자로 보지 않습니다.</p>
        <ul>
          <li>이용자가 제공한 원고의 오탈자, 내용, 편집 상태</li>
          <li>이용자가 미리보기에서 확인하고 선택한 판형, 본문 글자 크기, 표지 디자인과 사진</li>
          <li>모니터 화면과 인쇄물 사이의 일반적인 색 차이</li>
        </ul>
      </Section>

      <Section title="4. 인쇄·제본·배송 하자: 재제작 또는 환불">
        <p>받은 책에 다음과 같은 문제가 있으면 회사가 비용을 부담해 다시 만들어 보내거나 해당 금액을 환불합니다.</p>
        <ul>
          <li>낙장, 중복 페이지, 페이지 순서 오류, 제본 불량 등 인쇄·제본 하자</li>
          <li>결제 전 미리보기와 다른 내용이나 판형으로 제작된 경우</li>
          <li>배송 중 파손되었거나 주문한 수량보다 적게 도착한 경우</li>
        </ul>
        <p>
          책을 받은 날부터 3개월 이내, 문제를 안 날 또는 알 수 있었던 날부터 30일 이내에 주문번호와 하자 부분 사진을
          보내 주세요. 여러 권 중 일부에만 문제가 있으면 해당 권수만큼 처리합니다. 하자 확인을 위해 책을 돌려받아야
          하는 경우 반송 비용은 회사가 부담합니다.
        </p>
      </Section>

      <Section title="5. 회사 사정으로 제작할 수 없는 경우">
        <p>
          결제 후 인쇄 접수에 실패하거나 회사 사정으로 책을 제작·발송할 수 없게 되면, 회사가 먼저 연락드리고 결제 금액
          전액을 환불합니다. 이 경우 같은 주문을 다시 결제하지 말고 안내를 기다려 주세요.
        </p>
      </Section>

      <Section title="6. 환불 방법과 기간">
        <ul>
          <li>환불은 결제에 사용한 수단으로, 결제대행사를 통해 처리합니다.</li>
          <li>
            회사는 환불이 결정된 날부터 3영업일 이내에 결제 취소를 요청합니다. 실제로 환급되는 시점은 카드사와
            결제대행사의 처리 일정에 따라 다를 수 있습니다.
          </li>
          <li>
            외화로 결제한 경우 결제한 통화와 금액 그대로 환불되며, 카드사가 적용하는 환율과 해외 결제 수수료에 따라
            원화로 환산한 청구액과 환급액이 다를 수 있습니다.
          </li>
        </ul>
      </Section>

      <Section title="7. 문의">
        <p>
          취소·환불 요청과 문의는{" "}
          <a href={`mailto:${BUSINESS.email}`} className="text-white underline underline-offset-4">
            {BUSINESS.email}
          </a>
          로 보내 주세요. 서비스 이용 조건 전반은{" "}
          <Link href="/terms" className="text-white underline underline-offset-4">
            이용약관
          </Link>
          을 따릅니다.
        </p>
      </Section>
    </LegalPage>
  )
}
