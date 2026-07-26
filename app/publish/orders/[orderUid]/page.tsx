import Link from "next/link"
import { Metadata } from "next"
import { notFound } from "next/navigation"
import { CustomCursor } from "@/components/custom-cursor"
import { PUBLISH_ENABLED } from "@/lib/publishing/config"
import { getOrder, SweetBookError, type Order } from "@/lib/publishing/sweetbook"
import { RefreshButton } from "./refresh-button"

export const metadata: Metadata = {
  title: "주문 진행 상황 | 생각을나누다",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

// 정상 진행 순서. PDF_READY/COMPLETED 등 항목 단위 상태는 근접 단계로 흡수한다.
const TIMELINE = [
  { key: "PAID", label: "결제 완료", desc: "주문이 접수되었습니다" },
  { key: "CONFIRMED", label: "제작 확정", desc: "인쇄 일정이 배정되었습니다" },
  { key: "IN_PRODUCTION", label: "제작 중", desc: "인쇄·제본·포장이 진행 중입니다" },
  { key: "SHIPPED", label: "발송 완료", desc: "택배가 출발했습니다" },
  { key: "DELIVERED", label: "배송 완료", desc: "책이 도착했습니다" },
] as const

const STATUS_RANK: Record<string, number> = {
  PAID: 0,
  PDF_READY: 0,
  CONFIRMED: 1,
  IN_PRODUCTION: 2,
  COMPLETED: 2,
  PRODUCTION_COMPLETE: 2,
  SHIPPED: 3,
  DELIVERED: 4,
}

const krw = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`

interface PageProps {
  params: Promise<{ orderUid: string }>
}

export default async function OrderStatusPage({ params }: PageProps) {
  if (!PUBLISH_ENABLED) notFound()

  const { orderUid } = await params

  let order: Order
  try {
    order = await getOrder(orderUid)
  } catch (e) {
    if (e instanceof SweetBookError && e.status === 404) notFound()
    throw e
  }

  const cancelled = order.orderStatus === "CANCELLED" || order.orderStatus === "CANCELLED_REFUND"
  const errored = order.orderStatus === "ERROR"
  const rank = STATUS_RANK[order.orderStatus] ?? 0

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
        <div className="max-w-2xl mx-auto space-y-10">
          <header className="text-center space-y-3">
            <h1 className="font-playfair text-3xl sm:text-4xl font-light">주문 진행 상황</h1>
            <p className="text-sm text-text-gray break-all">
              주문번호 <span className="text-accent-orange select-all">{order.orderUid}</span>
            </p>
            {order.isTest && (
              <p className="inline-block text-[11px] tracking-widest uppercase border border-white/20 text-text-gray px-2 py-0.5">
                테스트 주문
              </p>
            )}
          </header>

          {(cancelled || errored) && (
            <div
              role="status"
              className={`border px-5 py-4 text-sm leading-relaxed ${
                errored
                  ? "border-red-400/40 bg-red-400/10 text-red-200"
                  : "border-white/20 bg-white/5 text-text-gray"
              }`}
            >
              {errored
                ? "주문 처리 중 오류가 발생했습니다. 확인 후 연락드리겠습니다."
                : `이 주문은 취소되었습니다 (${order.orderStatusDisplay}).`}
            </div>
          )}

          {/* 타임라인 */}
          {!cancelled && !errored && (
            <ol className="space-y-0">
              {TIMELINE.map((t, i) => {
                const reached = i <= rank
                const current = i === rank
                return (
                  <li key={t.key} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <span
                        className={`w-4 h-4 rounded-full border-2 shrink-0 mt-1 ${
                          reached ? "border-accent-orange bg-accent-orange" : "border-white/25"
                        }`}
                        aria-hidden
                      />
                      {i < TIMELINE.length - 1 && (
                        <span
                          className={`w-px flex-1 min-h-10 ${i < rank ? "bg-accent-orange" : "bg-white/15"}`}
                          aria-hidden
                        />
                      )}
                    </div>
                    <div className={`pb-8 ${reached ? "" : "opacity-50"}`}>
                      <p className={`font-medium ${current ? "text-accent-orange" : "text-white"}`}>
                        {t.label}
                        {current && (
                          <span className="ml-2 text-xs text-text-gray">— {order.orderStatusDisplay}</span>
                        )}
                      </p>
                      <p className="text-sm text-text-gray">{t.desc}</p>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}

          {/* 주문 내역 — 금액은 제작사 원가이므로 노출하지 않는다.
              결제 금액은 주문 완료 화면과 (Phase 1) 결제 영수증에서 안내한다. */}
          <div className="border border-white/15 divide-y divide-white/10">
            {(order.items ?? []).map((item) => (
              <div key={item.itemUid} className="px-5 py-4">
                <p className="text-white leading-snug">{item.bookTitle}</p>
                <p className="text-sm text-text-gray">
                  {item.pageCount ? `${item.pageCount}페이지 · ` : ""}
                  {item.quantity}권 · {item.itemStatusDisplay}
                </p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 text-sm text-text-gray">
            <span>
              {new Date(order.orderedAt).toLocaleDateString("ko-KR", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}{" "}
              주문 · {order.recipientName}님
            </span>
            <RefreshButton />
          </div>
        </div>
      </main>
    </div>
  )
}
