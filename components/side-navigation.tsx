"use client"

import Link from "next/link"

interface SideNavigationProps {
  activeSection: number
  onSectionClick: (index: number) => void
  onEmailClick: () => void
}

export function SideNavigation({ activeSection, onSectionClick, onEmailClick }: SideNavigationProps) {
  const sections = ["홈", "도서", "블로그", "연락"]

  return (
    <nav className="fixed left-0 top-0 h-screen w-20 bg-primary-dark/90 backdrop-blur-xl z-50 flex flex-col items-center justify-between py-8 border-r border-accent-orange/10">
      <div
        className="text-accent-orange font-playfair font-light text-sm tracking-widest"
        style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
      >
        생각을나누다
      </div>

      <div className="flex flex-col gap-4">
        {sections.map((_, index) => (
          <button
            key={index}
            onClick={() => onSectionClick(index)}
            className={`w-3 h-3 rounded-full transition-all duration-300 cursor-pointer ${
              activeSection === index ? "bg-accent-orange scale-125" : "bg-text-gray hover:bg-accent-orange/50"
            }`}
          />
        ))}
      </div>

      <div
        className="flex flex-col gap-2 text-text-gray text-xs tracking-wider items-start"
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
