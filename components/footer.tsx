"use client"

import { forwardRef } from "react"

export const Footer = forwardRef<HTMLElement>((props, ref) => {
  return (
    <footer ref={ref} className="bg-primary-dark py-16 px-8 lg:px-16 border-t border-accent-orange/10">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-16 mb-12">
        <div>
          <div className="font-playfair text-3xl text-accent-orange mb-4">생각을나누다</div>
          <p className="text-text-gray leading-relaxed">
            나누다컴퍼니는 여행의 소중한 경험과 감동을 책으로 담아 많은 사람들과 나눕니다. 
          </p>
        </div>

        <div>
          <h4 className="text-accent-orange font-medium mb-6">도서</h4>
          <div className="space-y-4">
            {["신간 도서", "베스트셀러", "전체 도서", "도서 주문"].map((link) => (
              <a key={link} href="#" className="block text-text-gray hover:text-accent-orange transition-colors">
                {link}
              </a>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-accent-orange font-medium mb-6">연결</h4>
          <div className="space-y-4">
            {["블로그", "인스타그램", "출판 문의", "여행 상담"].map((link) => (
              <a key={link} href="#" className="block text-text-gray hover:text-accent-orange transition-colors">
                {link}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-accent-orange/10 pt-8 text-center text-text-gray">
        <p>© 2025 Nanuda Company. All right reserved.    </p>
      </div>
    </footer>
  )
})

Footer.displayName = "Footer"
