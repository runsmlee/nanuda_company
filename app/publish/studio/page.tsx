import Link from "next/link"
import { Metadata } from "next"
import { notFound } from "next/navigation"
import { CustomCursor } from "@/components/custom-cursor"
import { ManuscriptStudio } from "@/components/publish/manuscript-studio"
import type { WizardSpec } from "@/components/publish/publish-wizard"
import { PUBLISH_ENABLED } from "@/lib/publishing/config"
import { listBookSpecs } from "@/lib/publishing/sweetbook"

export const metadata: Metadata = {
  title: "원고로 책 만들기 | 생각을나누다",
  robots: { index: false, follow: false },
}

export const revalidate = 3600

export default async function StudioPage() {
  if (!PUBLISH_ENABLED) notFound()

  let specs: WizardSpec[] = []
  try {
    const raw = await listBookSpecs()
    specs = raw.map((s) => ({
      bookSpecUid: s.bookSpecUid,
      name: s.name,
      innerTrimWidthMm: s.innerTrimWidthMm,
      innerTrimHeightMm: s.innerTrimHeightMm,
      pageMin: s.pageMin,
      pageMax: s.pageMax,
      pageDefault: s.pageDefault,
      pageIncrement: s.pageIncrement,
      coverType: s.coverType,
      priceBase: s.priceBase ?? s.sandboxPriceBase ?? 0,
      pricePerIncrement: s.pricePerIncrement ?? s.sandboxPricePerIncrement ?? 0,
      paperSummary: [
        s.paper?.cover?.paper && `표지 ${s.paper.cover.paper}`,
        s.paper?.inner?.paper && `내지 ${s.paper.inner.paper}`,
      ]
        .filter(Boolean)
        .join(" · "),
      bleedMm: s.bleedMm,
    }))
  } catch {
    // specs가 비면 스튜디오가 안내 문구를 보여준다
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <CustomCursor />
      <nav className="px-6 sm:px-8 lg:px-12 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/publish" className="text-text-gray hover:text-white transition-colors text-sm">
            ← 자가출판 소개
          </Link>
          <Link href="/publish/start" className="text-sm text-text-gray hover:text-white transition-colors">
            인쇄용 PDF가 이미 있어요 →
          </Link>
        </div>
      </nav>

      <main className="px-6 sm:px-8 lg:px-12 pb-24">
        <header className="max-w-3xl mx-auto text-center mb-12">
          <p className="text-accent-orange text-sm tracking-[0.3em] uppercase mb-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
            Studio
            <span className="tracking-normal normal-case text-xs whitespace-nowrap border border-accent-orange/50 px-2 py-0.5">
              베타
            </span>
          </p>
          <h1 className="font-playfair text-3xl sm:text-4xl lg:text-5xl font-light mb-4">
            원고로 책 만들기
          </h1>
          <p className="text-text-gray leading-relaxed">
            워드 파일을 올리면 인쇄 가능한 책으로 조판해 드립니다.
            <br className="hidden sm:block" />
            결과를 눈으로 확인하고 마음에 들 때까지 바꿔보세요.
          </p>
        </header>

        <div className="max-w-7xl mx-auto">
          {specs.length === 0 ? (
            <p className="text-center text-text-gray py-16">
              지금은 판형 정보를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.
            </p>
          ) : (
            <ManuscriptStudio specs={specs} />
          )}
        </div>
      </main>
    </div>
  )
}
