import Link from "next/link"
import type { Metadata } from "next"
import type { ReactNode } from "react"
import { absoluteUrl, COMPANY_NAME, SITE_NAME } from "@/lib/site-config"

// 사업자등록증(2023.07.17 정정)·출판사 신고확인증 기준.
export const BUSINESS = {
  name: COMPANY_NAME,
  brand: SITE_NAME,
  representatives: "이상민, 정예원",
  registrationNo: "109-96-78318",
  publisherNo: "제333-2021-000017호",
  address: "부산광역시 해운대구 해운대해변로 141, 206동 1201호(우동, 대우마리나)",
  email: "simon@nanudacompany.com",
}

export const LEGAL_LINKS = [
  { href: "/terms", label: "이용약관" },
  { href: "/privacy", label: "개인정보처리방침" },
  { href: "/refund", label: "취소·환불 정책" },
]

export const EFFECTIVE_DATE = "2026년 10월 12일"

export function legalMetadata(path: string, title: string, description: string): Metadata {
  return {
    title: `${title} | ${SITE_NAME}`,
    description,
    alternates: { canonical: absoluteUrl(path) },
  }
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium text-white">{title}</h2>
      <div className="space-y-3 text-text-gray leading-relaxed [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_strong]:text-white [&_strong]:font-medium">
        {children}
      </div>
    </section>
  )
}

export function LegalPage({ path, title, children }: { path: string; title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <nav className="px-6 sm:px-8 lg:px-16 py-6">
        <div className="max-w-3xl mx-auto">
          <Link href="/" className="text-text-gray hover:text-white transition-colors text-sm">
            ← {SITE_NAME}
          </Link>
        </div>
      </nav>

      <main className="px-6 sm:px-8 lg:px-16 pt-8 pb-20">
        <article className="max-w-3xl mx-auto space-y-10">
          <header className="space-y-3">
            <h1 className="font-playfair text-3xl sm:text-4xl font-light">{title}</h1>
            <p className="text-sm text-text-gray">시행일 {EFFECTIVE_DATE}</p>
          </header>
          {children}
        </article>
      </main>

      <footer className="px-6 sm:px-8 lg:px-16 py-10 border-t border-white/10 text-sm text-text-gray">
        <div className="max-w-3xl mx-auto space-y-4">
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {LEGAL_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={l.href === path ? "page" : undefined}
                  className={l.href === path ? "text-white" : "hover:text-white transition-colors"}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <BusinessInfo />
        </div>
      </footer>
    </div>
  )
}

export function BusinessInfo() {
  return (
    <div className="space-y-1 text-xs leading-relaxed">
      <p>
        상호 {BUSINESS.name} · 대표 {BUSINESS.representatives} · 사업자등록번호 {BUSINESS.registrationNo}
      </p>
      <p>
        출판사 {BUSINESS.brand} · 출판사 신고번호 {BUSINESS.publisherNo}
      </p>
      <p>주소 {BUSINESS.address}</p>
      <p>
        이메일 <a href={`mailto:${BUSINESS.email}`} className="hover:text-white">{BUSINESS.email}</a>
      </p>
    </div>
  )
}
