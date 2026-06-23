"use client"

import type React from "react"

import { useRef, useState } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { X } from "lucide-react"

interface EmailModalProps {
  isOpen: boolean
  onClose: () => void
}

export function EmailModal({ isOpen, onClose }: EmailModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  })

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

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />

        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[101] max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg bg-secondary-dark focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0"
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            closeButtonRef.current?.focus()
          }}
        >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-text-gray/20">
          <Dialog.Title className="font-playfair text-2xl font-normal text-text-light sm:text-3xl">
            나누다컴퍼니에 연락하기
          </Dialog.Title>
          <Dialog.Close
            ref={closeButtonRef}
            aria-label="문의 창 닫기"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-orange"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </Dialog.Close>
        </div>
        <Dialog.Description className="sr-only">
          이름, 이메일, 제목, 메시지를 입력하면 기본 이메일 앱에 문의 내용이 작성됩니다.
        </Dialog.Description>

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
              className="flex min-h-11 flex-1 items-center justify-center bg-accent-orange px-6 py-3 font-medium text-white transition-colors hover:bg-accent-orange/90 cursor-pointer"
            >
              이메일 보내기
            </button>
            <Dialog.Close asChild>
              <button
                type="button"
                className="min-h-11 px-6 py-3 border border-text-gray text-text-gray hover:bg-text-gray hover:text-primary-dark transition-colors cursor-pointer"
              >
                취소
              </button>
            </Dialog.Close>
          </div>
        </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
