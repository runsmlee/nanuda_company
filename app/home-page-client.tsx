"use client"

import { useEffect, useRef, useState } from "react"
import { CustomCursor } from "@/components/custom-cursor"
import { SideNavigation } from "@/components/side-navigation"
import { HeroSection } from "@/components/hero-section"
import { BooksSection } from "@/components/books-section"
import { BlogSection } from "@/components/blog-section"
import { FaqSection } from "@/components/faq-section"
import { Footer } from "@/components/footer"
import { EmailModal } from "@/components/email-modal"

export function HomePageClient() {
  const [activeSection, setActiveSection] = useState(0)
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false)
  const sectionsRef = useRef<(HTMLElement | null)[]>([])

  useEffect(() => {
    const sections = sectionsRef.current.filter(Boolean) as HTMLElement[]

    if (sections.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const activeEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]

        if (!activeEntry) return

        const nextActiveSection = sectionsRef.current.findIndex((section) => section === activeEntry.target)
        if (nextActiveSection >= 0) {
          setActiveSection(nextActiveSection)
        }
      },
      {
        rootMargin: "-35% 0px -55% 0px",
        threshold: 0,
      },
    )

    sections.forEach((section) => observer.observe(section))

    return () => observer.disconnect()
  }, [])

  const scrollToSection = (index: number) => {
    sectionsRef.current[index]?.scrollIntoView({
      behavior: "smooth",
    })
  }

  return (
    <div className="bg-primary-dark text-text-light overflow-x-hidden">
      <CustomCursor />
      <SideNavigation
        activeSection={activeSection}
        onSectionClick={scrollToSection}
        onEmailClick={() => setIsEmailModalOpen(true)}
      />

      <main className="ml-14 sm:ml-16 lg:ml-20">
        <HeroSection ref={(el) => { sectionsRef.current[0] = el }} />
        <BooksSection ref={(el) => { sectionsRef.current[1] = el }} />
        <BlogSection ref={(el) => { sectionsRef.current[2] = el }} />
        <FaqSection />
        <Footer ref={(el) => { sectionsRef.current[3] = el }} />
      </main>

      <EmailModal isOpen={isEmailModalOpen} onClose={() => setIsEmailModalOpen(false)} />
    </div>
  )
}
