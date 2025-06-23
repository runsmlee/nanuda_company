"use client"

import type React from "react"

import { useState, useEffect } from "react"

interface EmailModalProps {
  isOpen: boolean
  onClose: () => void
}

export function EmailModal({ isOpen, onClose }: EmailModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  })

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }

    return () => {
      document.body.style.overflow = "unset"
    }
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape)
    }

    return () => document.removeEventListener("keydown", handleEscape)
  }, [isOpen, onClose])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Create mailto link
    const subject = encodeURIComponent(formData.subject || "나누다컴퍼니 문의")
    const body = encodeURIComponent(
      `안녕하세요,\n\n보내는 사람: ${formData.name}\n이메일: ${formData.email}\n\n${formData.message}`,
    )
    const mailtoLink = `mailto:simon@nanudacompany.com?subject=${subject}&body=${body}`

    // Open email client
    window.location.href = mailtoLink

    // Reset form and close modal
    setFormData({ name: "", email: "", subject: "", message: "" })
    onClose()
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-pointer" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-secondary-dark rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-text-gray/20">
          <h2 className="font-playfair text-3xl font-normal text-text-light">나누다컴퍼니에 연락하기</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-text-light mb-2">
                이름 *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-primary-dark border border-text-gray/30 rounded-lg text-text-light placeholder-text-gray focus:border-accent-orange focus:outline-none"
                placeholder="성함을 입력해주세요"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-text-light mb-2">
                이메일 *
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-primary-dark border border-text-gray/30 rounded-lg text-text-light placeholder-text-gray focus:border-accent-orange focus:outline-none"
                placeholder="이메일 주소를 입력해주세요"
              />
            </div>
          </div>

          <div>
            <label htmlFor="subject" className="block text-sm font-medium text-text-light mb-2">
              제목
            </label>
            <input
              type="text"
              id="subject"
              name="subject"
              value={formData.subject}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-primary-dark border border-text-gray/30 rounded-lg text-text-light placeholder-text-gray focus:border-accent-orange focus:outline-none"
              placeholder="문의 제목을 입력해주세요"
            />
          </div>

          <div>
            <label htmlFor="message" className="block text-sm font-medium text-text-light mb-2">
              메시지 *
            </label>
            <textarea
              id="message"
              name="message"
              required
              rows={6}
              value={formData.message}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-primary-dark border border-text-gray/30 rounded-lg text-text-light placeholder-text-gray focus:border-accent-orange focus:outline-none resize-none"
              placeholder="문의하실 내용을 자세히 적어주세요..."
            />
          </div>

          <div className="bg-primary-dark p-4 rounded-lg">
            <p className="text-text-gray text-sm">
              이 양식을 제출하면 기본 이메일 클라이언트가 열리며, 작성하신 내용이 자동으로 입력됩니다.
            </p>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              className="flex-1 bg-accent-orange text-white py-3 px-6 rounded-lg font-medium hover:bg-accent-orange/90 transition-colors cursor-pointer"
            >
              이메일 보내기
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-text-gray text-text-gray rounded-lg hover:bg-text-gray hover:text-primary-dark transition-colors cursor-pointer"
            >
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
