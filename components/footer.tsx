"use client"

import { forwardRef, useState } from "react"
import Image from "next/image"
import { EmailModal } from "./email-modal"

export const Footer = forwardRef<HTMLElement>((props, ref) => {
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false)

  return (
    <>
      <footer ref={ref} className="bg-primary-dark py-16 px-8 lg:px-16 border-t border-accent-orange/10">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 mb-12">
            <div>
              {/* 로고 */}
              <div className="mb-6">
                <Image
                  src="/images/nanuda_logo.png"
                  alt="나누다컴퍼니 로고"
                  width={150}
                  height={50}
                  className="brightness-0 invert" // 로고를 흰색으로 변환
                />
              </div>
              
              <div className="font-playfair text-3xl text-accent-orange mb-4">생각을나누다</div>
              <p className="text-text-gray leading-relaxed mb-6">
                우리 모두가 작가입니다
              </p>

              {/* 회사 기본 정보 */}
              <div className="text-text-gray text-sm space-y-1">
                <p>회사: 나누다컴퍼니</p>
                <p>대표: 이상민, 정예원</p>
                <p>이메일: simon@nanudacompany.com</p>
                <p>사업자등록번호: 109-96-78318</p>
              </div>
            </div>

            <div>
              <h4 className="text-accent-orange font-medium mb-6">문의하기</h4>
              <div className="space-y-4">
                <button
                  onClick={() => setIsEmailModalOpen(true)}
                  className="block text-text-gray hover:text-accent-orange transition-colors cursor-pointer text-left"
                >
                  출판 문의
                </button>
                <p className="text-text-gray text-sm">
                  당신의 이야기를 책으로 만들고 싶으신가요?<br />
                  언제든 편하게 문의해 주세요.
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-accent-orange/10 pt-8 text-center text-text-gray">
            <p>© 2025 Nanuda Company. All rights reserved.</p>
          </div>
        </div>
      </footer>

      <EmailModal 
        isOpen={isEmailModalOpen} 
        onClose={() => setIsEmailModalOpen(false)} 
      />
    </>
  )
})

Footer.displayName = "Footer"
