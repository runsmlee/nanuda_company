"use client"

import Link from "next/link"
import Image from "next/image"

interface SideNavigationProps {
  activeSection: number
  onSectionClick: (index: number) => void
  onEmailClick: () => void
}

export function SideNavigation({ activeSection, onSectionClick, onEmailClick }: SideNavigationProps) {
  const sections = ["홈", "도서", "블로그", "연락"]

  return (
    <nav className="fixed left-0 top-0 h-screen w-14 bg-primary-dark/95 backdrop-blur-sm z-50 flex flex-col items-center justify-between py-5 border-r border-accent-orange/10 sm:w-16 sm:py-6 lg:w-20 lg:py-8">
      <div className="flex flex-col items-center gap-3 sm:gap-4">
        <div className="relative h-[7px] w-8 sm:h-2 sm:w-10 lg:h-2.5 lg:w-12">
          <Image
            src="/images/nanuda_logo.png"
            alt="생각을 나누다 로고"
            fill
            className="object-contain brightness-0 invert"
            sizes="(max-width: 640px) 32px, (max-width: 1024px) 40px, 48px"
            priority
          />
        </div>
        <div
          className="text-accent-orange font-playfair font-light text-[11px] tracking-widest sm:text-xs lg:text-sm"
          style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
        >
          생각을나누다
        </div>
      </div>

      <div className="flex flex-col gap-1 sm:gap-2 lg:gap-4">
        {sections.map((section, index) => (
          <button
            key={index}
            aria-label={`${section} 섹션으로 이동`}
            onClick={() => onSectionClick(index)}
            className="flex h-11 w-11 items-center justify-center rounded-full transition-colors cursor-pointer"
          >
            <span
              className={`block rounded-full transition-all duration-300 ${
                activeSection === index
                  ? "h-3.5 w-3.5 bg-accent-orange"
                  : "h-2.5 w-2.5 bg-text-gray hover:bg-accent-orange/50"
              }`}
            />
          </button>
        ))}
      </div>

      <div
        className="hidden flex-col gap-2 text-text-gray text-xs tracking-wider items-start sm:flex"
        style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
      >
        <a
          href="https://www.instagram.com/mindful_journey_one/profilecard/?igsh=d2h3cWFtb2tidzZ1"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-accent-orange transition-colors cursor-pointer"
        >
          INSTAGRAM
        </a>
        <Link href="/column" className="hover:text-accent-orange transition-colors cursor-pointer">
          BLOG
        </Link>
        <button onClick={onEmailClick} className="hover:text-accent-orange transition-colors cursor-pointer">
          EMAIL
        </button>
      </div>
    </nav>
  )
}
