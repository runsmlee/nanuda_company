import Link from "next/link"
import { Metadata } from "next"
import { notFound } from "next/navigation"
import { CustomCursor } from "@/components/custom-cursor"
import { authorizedOrder, type Order } from "@/lib/publishing/db"
import { DonePoller } from "./done-poller"

export const metadata: Metadata = {
  title: "결제 완료 | 생각을나누다",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}

export const dynamic = "force-dynamic"

const krw = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`

const STATUS_COPY: Record<Order["status"], { title: string; body: string }> = {
  pending: {
    title: "결제를 확인하고 있습니다",
    body: "결제가 확인되면 책을 만들어 인쇄소로 넘깁니다. 이 화면이 자동으로 바뀝니다.",
  },
  paid: {
    title: "결제가 확인되었습니다",
    body: "책을 만들고 있습니다. 인쇄소에 접수되면 주문번호가 이 화면에 나타납니다.",
  },
  submitted: {
    title: "책이 인쇄소로 전달되었습니다",
    body: "아래 주문번호로 제작·배송 진행을 확인할 수 있습니다.",
  },
  failed: {
    title: "제작 접수에 문제가 생겼습니다",
    body: "주문 처리 상황을 확인하고 있습니다. 중복 결제를 하지 말고 아래 주문번호로 문의해주세요.",
  },
  refunded: {
    title: "결제가 환불되었습니다",
    body: "결제 환불이 확인되었습니다. 인쇄 취소 상태는 아래에서 확인해주세요.",
  },
  cancelled: {
    title: "주문이 취소되었습니다",
    body: "이 주문은 더 이상 진행되지 않습니다.",
  },
}

interface PageProps {
  searchParams: Promise<{ ref?: string; token?: string }>
}

export default async function CheckoutDonePage({ searchParams }: PageProps) {
  const { ref, token } = await searchParams
  if (!ref || !/^[0-9a-f-]{36}$/i.test(ref)) notFound()
  const order = await authorizedOrder(ref, token)
  if (!order) notFound()

  const copy = order.review_required && order.status === "pending"
    ? { title: "주문 확인이 필요합니다", body: "결제 내역을 대조하고 있습니다. 추가 결제를 하지 말고 아래 주문번호로 문의해주세요." }
    : order.status === "pending" && !order.checkout_url
    ? { title: "결제를 준비하고 있습니다", body: "아직 결제 완료가 확인되지 않았습니다. 스튜디오에서 같은 주문으로 다시 시도할 수 있습니다." }
    : order.refunded_total_minor > 0 && order.status !== "refunded"
    ? { title: "일부 금액이 환불되었습니다", body: "주문 진행 여부를 확인하고 있습니다. 아래 주문번호로 문의해주세요." }
    : STATUS_COPY[order.status] ?? STATUS_COPY.pending

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <CustomCursor />
      <nav className="px-6 sm:px-8 lg:px-16 py-6">
        <div className="max-w-2xl mx-auto">
          <Link href="/publish" className="text-text-gray hover:text-white transition-colors text-sm">
            ← 자가출판 소개
          </Link>
        </div>
      </nav>

      <main className="px-6 sm:px-8 lg:px-16 pb-24">
        <div className="max-w-2xl mx-auto text-center space-y-8 py-8">
          <div className="space-y-3">
            <h1 className="font-playfair text-3xl sm:text-4xl font-light">{copy.title}</h1>
            <p className="text-text-gray leading-relaxed">{copy.body}</p>
            <DonePoller active={order.status === "pending" || order.status === "paid" || (order.status === "failed" && !order.review_required)} />
            <p className="text-xs text-text-gray break-all select-all">주문번호 {order.id}</p>
            <p className="text-sm"><a className="text-accent-orange underline" href={`mailto:simon@nanudacompany.com?subject=${encodeURIComponent(`책 제작 주문 문의 ${order.id}`)}`}>주문 문의</a></p>
            <p className="text-xs text-text-gray">이 페이지 주소를 보관하면 다시 주문을 확인할 수 있습니다.</p>
          </div>

          <div className="border border-white/15 bg-white/5 px-6 py-5 space-y-2">
            <p className="text-xs uppercase tracking-widest text-text-gray">{order.charged_total_minor == null ? "주문 예상 금액" : "실제 결제 금액"}</p>
            <p className="text-lg text-accent-orange font-medium">{krw(order.charged_total_minor == null ? order.price_krw : order.charged_total_minor / 100)}</p>
            <p className="text-sm text-text-gray">{order.quantity}권</p>
            {order.refunded_total_minor > 0 && <p className="text-sm text-text-gray">환불 금액 {krw(order.refunded_total_minor / 100)}</p>}
            {order.status === "refunded" && <p className="text-sm text-text-gray">{
              ["cancelled", "not_started"].includes(order.cancellation_status ?? "") ? "인쇄 취소가 확인되었습니다."
              : order.cancellation_status === "needs_review" || order.review_required ? "인쇄가 진행 중이어서 취소 여부를 확인하고 있습니다. 주문번호로 문의해주세요."
              : "인쇄 취소 여부를 확인하고 있습니다."
            }</p>}
          </div>

          {order.print_order_uid && (
            <div className="border border-white/15 bg-white/5 px-6 py-5 space-y-2">
              <p className="text-xs uppercase tracking-widest text-text-gray">주문번호</p>
              <p className="text-lg text-accent-orange font-medium break-all select-all">
                {order.print_order_uid}
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {order.print_order_uid && order.status !== "refunded" ? (
              <Link
                href={`/publish/orders/${order.print_order_uid}?token=${token}`}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-accent-orange text-[#1a1a1a] font-medium hover:bg-accent-orange/85 transition-colors"
              >
                제작 진행 보기
              </Link>
            ) : (
              <Link
                href={`/publish/orders/done?ref=${order.id}&token=${token}`}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 border border-white/20 text-white hover:border-white/50 transition-colors"
              >
                다시 확인
              </Link>
            )}
            <Link
              href="/publish/studio"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 border border-white/20 text-text-gray hover:text-white hover:border-white/50 transition-colors"
            >
              스튜디오로 돌아가기
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
