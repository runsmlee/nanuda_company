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
    title: "원고 올리기",
    body: "워드 파일을 그대로 올리면 됩니다. 글자 수를 세어 어떤 판형에 맞는지 바로 알려드립니다.",
  },
  {
    step: "02",
    title: "조판·미리보기",
    body: "인쇄 가능한 책으로 조판해 펼침면으로 보여드립니다. 본문 크기를 바꾸면 쪽수와 금액이 함께 움직입니다.",
  },
  {
    step: "03",
    title: "표지 만들기",
    body: "제목과 저자명을 넣으면 표지가 만들어집니다. 책등 두께는 쪽수에서 자동으로 계산됩니다.",
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
            href="/publish/studio"
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
          <p className="text-accent-orange text-sm tracking-[0.3em] uppercase mb-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
            Self Publishing
            <span className="tracking-normal normal-case text-xs whitespace-nowrap border border-accent-orange/50 px-2 py-0.5">
              베타
            </span>
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
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <Link
                href="/publish/studio"
                className="inline-flex items-center gap-3 px-8 py-4 bg-accent-orange text-white font-medium hover:bg-accent-orange/85 transition-colors text-lg"
              >
                원고로 책 만들기
                <span aria-hidden>→</span>
              </Link>
              <Link
                href="/publish/start"
                className="inline-flex items-center gap-2 px-6 py-4 border border-white/20 text-text-gray hover:text-white hover:border-white/50 transition-colors"
              >
                인쇄용 PDF가 이미 있어요
              </Link>
            </div>
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
            준비물은 워드 파일 하나
          </h2>
          <div className="space-y-4 text-text-gray leading-relaxed">
            <p>
              <span className="text-white">원고 파일(.docx)</span>만 있으면 됩니다. 책등 두께나
              재단 여백 같은 인쇄 규격은 저희가 맞춥니다. 저자분은 글에만 집중하세요.
            </p>
            <p>
              한글(.hwp)을 쓰신다면 <span className="text-white">다른 이름으로 저장 → .docx</span>로
              저장해 올려주세요. 마크다운(.md)과 텍스트(.txt)도 받습니다.
            </p>
            <p className="text-sm">
              제목 스타일로 장을 나눠두시면 그대로 장 구분이 됩니다. 아직은 순수 글 원고를
              지원하며, 표와 본문 이미지는 다음 단계에서 지원할 예정입니다.
            </p>
            <p className="text-sm">
              이미 인쇄용 PDF를 직접 만드셨다면{" "}
              <span className="text-white">인쇄용 PDF가 이미 있어요</span> 쪽으로 바로 주문하실 수
              있습니다. 판형·쪽수에 맞는 표지 도면도 내려받을 수 있습니다.
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
              href="/publish/studio"
              className="inline-flex items-center gap-3 px-8 py-4 bg-accent-orange text-white font-medium hover:bg-accent-orange/85 transition-colors text-lg"
            >
              원고로 시작하기
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
