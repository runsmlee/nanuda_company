"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/** pending/paid 동안 서버 상태를 다시 읽어 접수 번호가 뜨면 멈춰다. */
export function DonePoller({ active }: { active: boolean }) {
  const router = useRouter()

  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => router.refresh(), 3000)
    return () => window.clearInterval(id)
  }, [active, router])

  if (!active) return null
  return (
    <p className="text-sm text-text-gray flex items-center justify-center gap-2" aria-live="polite">
      <span
        aria-hidden
        className="inline-block h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin motion-reduce:animate-none"
      />
      상태를 자동으로 확인하고 있습니다
    </p>
  )
}
