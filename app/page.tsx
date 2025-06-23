"use client"

import { useEffect, useRef, useState } from "react"
import { CustomCursor } from "@/components/custom-cursor"
import { SideNavigation } from "@/components/side-navigation"
import { HeroSection } from "@/components/hero-section"
import { BooksSection } from "@/components/books-section"
import { BlogSection } from "@/components/blog-section"
import { Footer } from "@/components/footer"
import { EmailModal } from "@/components/email-modal"

export default function HomePage() {
  const [activeSection, setActiveSection] = useState(0)
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false)
  const sectionsRef = useRef<(HTMLElement | null)[]>([])

  useEffect(() => {
    const handleScroll = () => {
      sectionsRef.current.forEach((section, index) => {
        if (section) {
          const rect = section.getBoundingClientRect()
          if (rect.top <= 200 && rect.bottom >= 200) {
            setActiveSection(index)
          }
        }
      })
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
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

      <main className="ml-20 lg:ml-20">
        <HeroSection ref={(el) => { sectionsRef.current[0] = el }} />
        <BooksSection ref={(el) => { sectionsRef.current[1] = el }} />
        <BlogSection ref={(el) => { sectionsRef.current[2] = el }} />
        <Footer ref={(el) => { sectionsRef.current[3] = el }} />
      </main>

      <EmailModal isOpen={isEmailModalOpen} onClose={() => setIsEmailModalOpen(false)} />
    </div>
  )
}
