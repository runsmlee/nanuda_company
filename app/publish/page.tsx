import Link from "next/link"
import { Metadata } from "next"
import { CustomCursor } from "@/components/custom-cursor"
import { PUBLISH_ENABLED } from "@/lib/publishing/config"
import { estimateProductPrice } from "@/lib/publishing/pricing"
import { listBookSpecs, type BookSpec } from "@/lib/publishing/sweetbook"
import { absoluteUrl, SITE_NAME } from "@/lib/site-config"

export const revalidate = 3600

const PAGE_TITLE = "자가출판 서비스 - 당신의 이야기를 책으로 | 생각을나누다"
const PAGE_DESCRIPTION =
  "원고를 책으로. 나누다컴퍼니의 자가출판 서비스로 에세이·여행기·기록집을 소량 인쇄 제작합니다. A5 에세이 판형부터 하드커버까지, 업로드부터 배송까지 한 번에."

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: absoluteUrl("/publish") },
  // 준비중일 때는 색인하지 않는다 (sitemap에서도 제외됨).
  robots: PUBLISH_ENABLED ? undefined : { index: false, follow: false },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: absoluteUrl("/publish"),
    siteName: SITE_NAME,
    type: "website",
    locale: "ko_KR",
  },
}

const PROCESS = [
  {
    step: "01",
    title: "판형 선택",
    body: "에세이에 어울리는 A5 소프트커버부터 하드커버까지, 페이지 수에 따른 가격을 바로 확인합니다.",
  },
  {
    step: "02",
    title: "원고 업로드",
    body: "인쇄용 표지·내지 PDF를 올리면 인쇄소 규격을 즉시 검증합니다. 맞지 않으면 이유를 알려드립니다.",
  },
  {
    step: "03",
    title: "주문 확정",
    body: "확정 견적을 확인하고 배송지를 입력하면 인쇄가 접수됩니다.",
  },
  {
    step: "04",
    title: "제작·배송",
    body: "제작 5~7 영업일 후 발송됩니다. 주문번호로 언제든 진행 상황을 확인할 수 있습니다.",
  },
]

// 수령 후 "생각과 다르다"가 나오지 않도록 사양을 미리 못 박는다.
const SPEC_NOTES = [
  ["인쇄", "CMYK 4도 풀컬러, 오프셋급 디지털 인쇄. 화면 색과는 다소 차이가 있습니다."],
  ["제본", "PUR 무선제본. 표지는 무광 라미네이팅으로 마감합니다."],
  ["수량", "1권부터 제작합니다. 여러 권일수록 권당 가격이 내려갑니다."],
  ["기간", "제작 5~7 영업일 후 발송. 배송 기간은 별도입니다."],
]

function coverLabel(type: BookSpec["coverType"]) {
  return type === "Hardcover" ? "하드커버" : "소프트커버"
}

export default async function PublishPage() {
  let specs: BookSpec[] = []
  try {
    specs = await listBookSpecs()
  } catch {
    // 판형 API 장애 시에도 소개 페이지는 뜬다. 가격 카드만 생략.
  }

  const featured = "PHOTOBOOK_A5_SC"

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <CustomCursor />

      {/* 상단 내비게이션 */}
      <nav className="px-6 sm:px-8 lg:px-16 py-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-text-gray hover:text-white transition-colors text-sm">
            ← 생각을나누다
          </Link>
          <Link
            href="/publish/start"
            className="text-sm text-accent-orange hover:text-white transition-colors"
          >
            바로 시작하기 →
          </Link>
        </div>
      </nav>

      {/* 준비중 배너 */}
      {!PUBLISH_ENABLED && (
        <div className="px-6 sm:px-8 lg:px-16">
          <div className="max-w-6xl mx-auto border border-accent-orange/40 bg-accent-orange/10 px-5 py-4 text-center">
            <p className="text-sm sm:text-base text-white">
              <span className="text-accent-orange font-medium">준비중</span> — 자가출판 서비스는
              오픈 준비 중입니다. 아래 내용은 실제 제작 사양과 가격 기준입니다.
            </p>
          </div>
        </div>
      )}

      {/* 히어로 */}
      <section className="px-6 sm:px-8 lg:px-16 pt-16 pb-24 sm:pt-24 sm:pb-32 relative">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-accent-orange text-sm tracking-[0.3em] uppercase mb-6">
            Self Publishing
          </p>
          <h1 className="font-playfair text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-light mb-8 leading-tight">
            당신의 이야기를
            <br />
            <span className="text-accent-orange">한 권의 책</span>으로
          </h1>
          <p className="text-lg sm:text-xl text-text-gray font-light leading-relaxed max-w-2xl mx-auto mb-12">
            여행의 기록, 아이의 일기, 오래 쓴 에세이.
            <br className="hidden sm:block" />
            출판사 생각을나누다가 원고에서 배송까지 책의 마지막 한 걸음을 함께합니다.
          </p>
          {PUBLISH_ENABLED ? (
            <Link
              href="/publish/start"
              className="inline-flex items-center gap-3 px-8 py-4 border-2 border-accent-orange text-accent-orange font-medium hover:bg-accent-orange hover:text-white transition-all duration-300 text-lg"
            >
              내 책 만들기
              <span aria-hidden>→</span>
            </Link>
          ) : (
            <div className="space-y-4">
              <span
                aria-disabled="true"
                className="inline-flex items-center gap-3 px-8 py-4 border-2 border-white/20 text-white/40 font-medium text-lg cursor-not-allowed select-none"
              >
                내 책 만들기
                <span aria-hidden>→</span>
              </span>
              <p className="text-sm text-text-gray">
                곧 만나요. 준비가 끝나면 이 페이지에서 바로 신청할 수 있습니다.
              </p>
            </div>
          )}
        </div>
        <div className="absolute top-20 right-20 w-2 h-2 bg-accent-orange rounded-full opacity-60" aria-hidden />
        <div className="absolute bottom-16 left-24 w-1 h-1 bg-accent-orange rounded-full opacity-40" aria-hidden />
      </section>

      {/* 제작 과정 */}
      <section className="px-6 sm:px-8 lg:px-16 py-20 border-t border-white/10">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-playfair text-3xl sm:text-4xl font-light mb-14 text-center">
            네 단계면 충분합니다
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {PROCESS.map((p) => (
              <div key={p.step} className="space-y-3">
                <p className="text-accent-orange font-playfair text-2xl">{p.step}</p>
                <h3 className="text-lg font-medium">{p.title}</h3>
                <p className="text-sm text-text-gray leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 판형과 가격 */}
      {specs.length > 0 && (
        <section className="px-6 sm:px-8 lg:px-16 py-20 border-t border-white/10">
          <div className="max-w-6xl mx-auto">
            <h2 className="font-playfair text-3xl sm:text-4xl font-light mb-4 text-center">
              판형과 가격
            </h2>
            <p className="text-text-gray text-center mb-14">
              1권부터 제작합니다. 페이지 수에 따라 가격이 정해집니다.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {specs.map((s) => {
                const isFeatured = s.bookSpecUid === featured
                return (
                  <div
                    key={s.bookSpecUid}
                    className={`border px-6 py-7 space-y-3 ${
                      isFeatured ? "border-accent-orange bg-accent-orange/5" : "border-white/15"
                    }`}
                  >
                    {isFeatured && (
                      <p className="text-[11px] tracking-widest uppercase text-accent-orange">
                        에세이 단행본 추천
                      </p>
                    )}
                    <h3 className="text-lg font-medium leading-snug">{s.name}</h3>
                    <p className="text-sm text-text-gray leading-relaxed">
                      {s.innerTrimWidthMm}×{s.innerTrimHeightMm}mm · {coverLabel(s.coverType)}
                      <br />
                      {s.pageMin}~{s.pageMax}페이지
                    </p>
                    <p className="text-white">
                      <span className="text-xl font-medium">
                        {estimateProductPrice(
                          {
                            pageMin: s.pageMin,
                            pageIncrement: s.pageIncrement,
                            priceBase: s.priceBase ?? s.sandboxPriceBase ?? 0,
                            pricePerIncrement: s.pricePerIncrement ?? s.sandboxPricePerIncrement ?? 0,
                          },
                          s.pageMin,
                          1,
                        ).toLocaleString("ko-KR")}
                        원
                      </span>
                      <span className="text-sm text-text-gray"> 부터</span>
                    </p>
                    {s.paper?.inner?.paper && (
                      <p className="text-xs text-text-gray">내지 {s.paper.inner.paper}</p>
                    )}
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-text-gray text-center mt-8">
              부가세 포함 가격입니다. 배송비 별도이며, 여러 권을 주문하면 권당 가격이 내려갑니다.
              최종 금액은 주문 전에 확정 견적으로 안내됩니다.
            </p>
          </div>
        </section>
      )}

      {/* 준비물 안내 */}
      <section className="px-6 sm:px-8 lg:px-16 py-20 border-t border-white/10">
        <div className="max-w-3xl mx-auto space-y-6">
          <h2 className="font-playfair text-3xl sm:text-4xl font-light text-center mb-10">
            준비물은 인쇄용 PDF 두 개
          </h2>
          <div className="space-y-4 text-text-gray leading-relaxed">
            <p>
              <span className="text-white">표지 PDF 1페이지</span> — 뒤표지·책등·앞표지가 이어진
              펼침 형태입니다. 판형과 페이지 수를 고르면 정확한 크기(mm)를 화면에서 알려드립니다.
            </p>
            <p>
              <span className="text-white">내지 PDF</span> — 본문 전체를 한 파일로. 페이지 수가
              주문 사양과 일치해야 하며, 업로드 즉시 규격을 검증해 결과를 보여드립니다.
            </p>
            <p className="text-sm">
              신청 화면에서 <span className="text-white">판형·페이지 수에 맞는 표지 도면</span>을
              바로 보여드리고 내려받을 수 있게 해드립니다. 책등 두께까지 계산된 도면이라 그대로
              디자인하시면 됩니다.
            </p>
            <p className="text-sm">
              아직 원고 단계라면 걱정하지 마세요. 조판(원고를 인쇄용 PDF로 만드는 일)이 필요한
              경우 하단 연락처로 문의해주시면 안내해드립니다.
            </p>
          </div>

          <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-4 pt-8 border-t border-white/10">
            {SPEC_NOTES.map(([k, v]) => (
              <div key={k}>
                <dt className="text-sm text-white mb-1">{k}</dt>
                <dd className="text-sm text-text-gray leading-relaxed">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="text-center pt-6">
            <Link
              href="/publish/start"
              className="inline-flex items-center gap-3 px-8 py-4 bg-accent-orange text-white font-medium hover:bg-accent-orange/85 transition-colors text-lg"
            >
              지금 시작하기
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </section>

      <footer className="px-6 sm:px-8 lg:px-16 py-10 border-t border-white/10 text-center text-sm text-text-gray">
        <p>
          문의 · <span className="text-white">생각을나누다</span> — 나누다컴퍼니 출판 브랜드
        </p>
      </footer>
    </div>
  )
}
