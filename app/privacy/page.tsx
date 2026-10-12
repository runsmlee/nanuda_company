import { BUSINESS, LegalPage, legalMetadata, Section } from "@/components/legal-page"

export const metadata = legalMetadata(
  "/privacy",
  "개인정보처리방침",
  "나누다컴퍼니가 자가출판 인쇄 서비스와 웹사이트에서 처리하는 개인정보의 항목, 목적, 보유 기간, 위탁과 국외 이전을 안내합니다.",
)

const ITEMS = [
  {
    when: "책 주문 (자가출판 서비스)",
    what: "이메일 주소, 저자명, 책 제목, 원고 파일과 파일명, 표지 사진(선택), 뒤표지 글(선택), 수령인 이름, 휴대전화 번호, 우편번호, 주소, 상세 주소(선택), 배송 메모(선택), 주문·결제·환불 기록",
    why: "책 조판과 인쇄, 배송, 결제와 환불 처리, 주문 조회, 하자 처리와 고객 문의 대응",
  },
  {
    when: "결제",
    what: "결제 수단 정보와 청구 정보는 결제대행사가 자체 결제 화면에서 직접 수집하며, 회사는 카드 번호를 받거나 저장하지 않습니다. 회사는 결제 식별번호, 결제·환불 금액과 통화를 보관합니다.",
    why: "결제 확인, 환불, 거래 기록 보관",
  },
  {
    when: "출판 문의",
    what: "이름, 이메일 주소, 문의 내용 (이용자의 메일 앱에서 회사 이메일로 직접 보내는 방식)",
    why: "문의 답변과 출간 협의",
  },
  {
    when: "사이트 이용 시 자동 생성",
    what: "접속 IP 주소, 브라우저·기기 정보, 방문 페이지와 시각",
    why: "서비스 제공과 보안, 쿠키를 쓰지 않는 방문 통계",
  },
]

const PROCESSORS = [
  {
    to: "스위트북(SweetBook)",
    task: "책 인쇄·제본·포장과 택배 발송",
    data: "책 제목, 저자명, 본문·표지 인쇄 파일, 수령인 이름, 휴대전화 번호, 우편번호, 주소, 배송 메모",
  },
  {
    to: "Link, LLC (Lemon Squeezy)",
    task: "결제 처리, 영수증 발송, 환불",
    data: "이메일 주소, 책 제목이 포함된 주문명, 주문 식별번호",
  },
  {
    to: "Supabase, Inc.",
    task: "주문 정보와 원고 파일 저장 (데이터 보관 위치: 대한민국 서울 리전)",
    data: "책 주문 시 수집하는 항목 전체",
  },
  {
    to: "Vercel Inc.",
    task: "웹사이트 호스팅과 주문 요청 처리, 방문 통계",
    data: "주문 요청에 담긴 정보, 접속 IP 주소, 브라우저·기기 정보",
  },
]

const TRANSFERS = [
  {
    to: "Link, LLC (Lemon Squeezy)",
    contact: "hello@lemonsqueezy.com",
    country: "미국",
    data: "이메일 주소, 책 제목이 포함된 주문명, 주문 식별번호",
    purpose: "결제 처리, 영수증 발송, 환불",
    period: "위탁 계약 종료 시 또는 관계 법령에 따른 보관 기간까지",
  },
  {
    to: "Vercel Inc.",
    contact: "privacy@vercel.com",
    country: "미국",
    data: "주문 요청에 담긴 정보, 접속 IP 주소, 브라우저·기기 정보",
    purpose: "웹사이트 호스팅과 요청 처리, 방문 통계",
    period: "위탁 계약 종료 시까지 (요청 처리 후 Vercel의 로그 보관 기간에 따라 삭제)",
  },
]

const td = "border border-white/10 px-3 py-2 align-top"

export default function PrivacyPage() {
  return (
    <LegalPage path="/privacy" title="개인정보처리방침">
      <p className="text-text-gray leading-relaxed">
        {BUSINESS.name}(이하 &ldquo;회사&rdquo;)는 「개인정보 보호법」에 따라 이용자의 개인정보를 보호하고 관련 고충을
        원활하게 처리하기 위해 다음과 같이 개인정보처리방침을 둡니다. 자가출판 서비스는 회원가입 없이 이용하며, 주문은
        이메일 주소와 주문 조회 링크로 확인합니다.
      </p>

      <Section title="1. 처리하는 개인정보 항목과 목적">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead className="text-white">
              <tr>
                <th className={`${td} text-left font-medium w-36`}>구분</th>
                <th className={`${td} text-left font-medium`}>항목</th>
                <th className={`${td} text-left font-medium w-48`}>목적</th>
              </tr>
            </thead>
            <tbody>
              {ITEMS.map((r) => (
                <tr key={r.when}>
                  <td className={td}>{r.when}</td>
                  <td className={td}>{r.what}</td>
                  <td className={td}>{r.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          원고와 표지 사진은 미리보기 단계에서는 서버에 저장하지 않고 화면 생성에만 사용하며, 이용자가 결제를 진행할 때
          저장됩니다. 회사는 원고를 주문한 책의 제작과 그에 따른 문의 대응 외의 목적으로 사용하지 않습니다.
        </p>
      </Section>

      <Section title="2. 보유 기간">
        <ul>
          <li>
            <strong>원고 파일, 표지 사진, 뒤표지 글:</strong> 책을 받은 날부터 3개월(하자 재제작 기간)이 지나면
            파기합니다. 결제가 완료되지 않은 주문의 파일은 결제 페이지가 만료된 뒤 파기합니다.
          </li>
          <li>
            <strong>주문·결제·배송 기록 (이메일, 수령인 정보 포함):</strong> 「전자상거래 등에서의 소비자보호에 관한
            법률」에 따라 계약 또는 청약철회 기록, 대금결제와 재화 공급 기록은 5년, 소비자 불만 또는 분쟁 처리 기록은
            3년간 보관합니다.
          </li>
          <li>
            <strong>출판 문의:</strong> 문의 처리가 끝나면 파기하며, 출간 협의가 이어지는 경우 협의가 끝날 때까지
            보관합니다.
          </li>
        </ul>
      </Section>

      <Section title="3. 처리 위탁">
        <p>회사는 서비스 제공을 위해 다음과 같이 개인정보 처리 업무를 위탁합니다.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead className="text-white">
              <tr>
                <th className={`${td} text-left font-medium w-44`}>수탁자</th>
                <th className={`${td} text-left font-medium`}>위탁 업무</th>
                <th className={`${td} text-left font-medium`}>제공 항목</th>
              </tr>
            </thead>
            <tbody>
              {PROCESSORS.map((r) => (
                <tr key={r.to}>
                  <td className={td}>{r.to}</td>
                  <td className={td}>{r.task}</td>
                  <td className={td}>{r.data}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>회사는 위의 경우 외에 이용자의 개인정보를 제3자에게 제공하지 않습니다. 법령에 따라 요구되는 경우는 예외로 합니다.</p>
      </Section>

      <Section title="4. 국외 이전">
        <p>
          결제와 웹사이트 운영을 위해 다음 개인정보가 국외로 이전됩니다. 이전은 이용자가 주문하거나 사이트에 접속할 때
          암호화된 네트워크를 통해 이루어집니다. 국외 이전을 원하지 않으면 주문을 하지 않을 수 있으나, 이 경우 책 주문
          서비스를 이용할 수 없습니다.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead className="text-white">
              <tr>
                <th className={`${td} text-left font-medium`}>이전받는 자 (연락처)</th>
                <th className={`${td} text-left font-medium w-16`}>국가</th>
                <th className={`${td} text-left font-medium`}>항목</th>
                <th className={`${td} text-left font-medium`}>목적</th>
                <th className={`${td} text-left font-medium`}>보유 기간</th>
              </tr>
            </thead>
            <tbody>
              {TRANSFERS.map((r) => (
                <tr key={r.to}>
                  <td className={td}>
                    {r.to}
                    <br />
                    {r.contact}
                  </td>
                  <td className={td}>{r.country}</td>
                  <td className={td}>{r.data}</td>
                  <td className={td}>{r.purpose}</td>
                  <td className={td}>{r.period}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="5. 파기 절차와 방법">
        <p>
          보유 기간이 끝나거나 처리 목적을 달성한 개인정보는 지체 없이 파기합니다. 전자 파일은 복구할 수 없는 방법으로
          삭제하고, 종이 문서는 분쇄하거나 소각합니다. 법령에 따라 보관해야 하는 정보는 다른 정보와 분리해 보관합니다.
        </p>
      </Section>

      <Section title="6. 이용자의 권리와 행사 방법">
        <p>
          이용자는 언제든지 자신의 개인정보에 대해 열람, 정정, 삭제, 처리정지를 요구할 수 있습니다. 주문번호와 결제한
          이메일 주소를 적어{" "}
          <a href={`mailto:${BUSINESS.email}`} className="text-white underline underline-offset-4">
            {BUSINESS.email}
          </a>
          로 요청하면 본인 확인 후 지체 없이 처리합니다. 다만 법령에 따라 보관해야 하는 정보는 그 기간 동안 삭제할 수
          없으며, 제작이 확정된 주문의 원고를 삭제하면 하자 재제작이 어려울 수 있습니다.
        </p>
      </Section>

      <Section title="7. 안전성 확보 조치">
        <ul>
          <li>주문 정보와 원고는 외부에서 접근할 수 없는 비공개 저장소에 보관하고, 서버만 접근하도록 권한을 제한합니다.</li>
          <li>모든 전송 구간은 HTTPS로 암호화합니다.</li>
          <li>주문 조회 링크에는 추측할 수 없는 무작위 값을 사용하며, 주문 조회 페이지는 검색과 방문 통계에서 제외합니다.</li>
          <li>개인정보를 다루는 인원을 최소한으로 제한합니다.</li>
        </ul>
      </Section>

      <Section title="8. 쿠키와 자동 수집 장치">
        <p>
          이 사이트는 쿠키를 사용하지 않습니다. 방문 통계는 쿠키 없이 집계하는 Vercel Web Analytics로 수집하며, 주문 조회
          페이지는 집계하지 않습니다. 책 주문 중에는 같은 주문이 두 번 결제되지 않도록 진행 중인 주문 정보를 브라우저의
          세션 저장소에 잠시 보관하며, 이 정보는 브라우저 탭을 닫으면 삭제됩니다.
        </p>
      </Section>

      <Section title="9. 개인정보 보호책임자">
        <ul>
          <li>책임자: 이상민 (대표)</li>
          <li>
            이메일:{" "}
            <a href={`mailto:${BUSINESS.email}`} className="text-white underline underline-offset-4">
              {BUSINESS.email}
            </a>
          </li>
        </ul>
      </Section>

      <Section title="10. 권익침해 구제 방법">
        <p>개인정보 침해에 대한 신고나 상담이 필요하면 아래 기관에 문의할 수 있습니다.</p>
        <ul>
          <li>개인정보분쟁조정위원회: 1833-6972 (www.kopico.go.kr)</li>
          <li>개인정보침해신고센터: 118 (privacy.kisa.or.kr)</li>
          <li>대검찰청: 1301 (www.spo.go.kr)</li>
          <li>경찰청: 182 (ecrm.police.go.kr)</li>
        </ul>
      </Section>

      <Section title="11. 방침의 변경">
        <p>이 방침의 내용이 바뀌면 시행 7일 전부터 이 페이지에 변경 내용과 시행일을 알립니다.</p>
      </Section>
    </LegalPage>
  )
}
