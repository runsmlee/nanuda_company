import Link from "next/link"

export default function OrderNotFound() {
  return (
    <main className="min-h-screen bg-[#1a1a1a] text-white px-6 py-24">
      <div className="max-w-xl mx-auto space-y-6">
        <h1 className="text-3xl">주문 확인 링크가 필요합니다</h1>
        <p className="text-text-gray leading-relaxed">
          결제 영수증의 ‘주문 진행 확인’ 버튼을 이용해주세요. 이전 주문의 링크가 열리지 않거나
          링크를 잃어버렸다면 주문번호와 결제 이메일을 알려주세요.
        </p>
        <a href="mailto:simon@nanudacompany.com?subject=책%20제작%20주문%20조회%20문의" className="block text-accent-orange underline">주문 조회 문의</a>
        <Link href="/publish/studio" className="block text-text-gray underline">스튜디오로 돌아가기</Link>
      </div>
    </main>
  )
}
