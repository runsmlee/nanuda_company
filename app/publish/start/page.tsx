import Link from "next/link"
import { Metadata } from "next"
import { CustomCursor } from "@/components/custom-cursor"
import { PublishWizard, type WizardSpec } from "@/components/publish/publish-wizard"
import { listBookSpecs } from "@/lib/publishing/sweetbook"

export const metadata: Metadata = {
  title: "책 만들기 | 생각을나누다",
  robots: { index: false, follow: false },
}

export const revalidate = 3600

export default async function PublishStartPage() {
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
      paperSummary: [s.paper?.cover?.paper && `표지 ${s.paper.cover.paper}`, s.paper?.inner?.paper && `내지 ${s.paper.inner.paper}`]
        .filter(Boolean)
        .join(" · "),
    }))
  } catch {
    // specs가 비면 위저드가 안내 문구를 보여준다
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <CustomCursor />
      <nav className="px-6 sm:px-8 lg:px-16 py-6">
        <div className="max-w-3xl mx-auto">
          <Link href="/publish" className="text-text-gray hover:text-white transition-colors text-sm">
            ← 자가출판 소개
          </Link>
        </div>
      </nav>
      <main className="px-6 sm:px-8 lg:px-16 pb-24">
        <header className="max-w-3xl mx-auto text-center mb-12">
          <h1 className="font-playfair text-3xl sm:text-4xl lg:text-5xl font-light mb-4">
            내 책 만들기
          </h1>
          <p className="text-text-gray leading-relaxed">
            네 단계로 끝납니다. 어느 단계에서든 뒤로 돌아가 수정할 수 있습니다.
          </p>
        </header>
        <PublishWizard specs={specs} />
      </main>
    </div>
  )
}
