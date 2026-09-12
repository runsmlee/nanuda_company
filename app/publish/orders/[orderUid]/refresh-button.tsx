"use client"

import { useRouter } from "next/navigation"
import { useEffect, useTransition } from "react"

export function RefreshButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    const id = window.setInterval(() => {
      startTransition(() => router.refresh())
    }, 8000)
    return () => window.clearInterval(id)
  }, [router])

  return (
    <div className="flex items-center gap-3">
      <p className="text-xs text-text-gray" aria-live="polite">
        {pending ? "상태를 확인하고 있습니다" : "8초마다 자동으로 확인합니다"}
      </p>
      <button
        type="button"
        onClick={() => startTransition(() => router.refresh())}
        disabled={pending}
        className="px-5 py-2.5 border border-white/20 text-sm text-text-gray hover:text-white hover:border-white/50 transition-colors disabled:opacity-50"
      >
        {pending ? "새로고침 중…" : "상태 새로고침"}
      </button>
    </div>
  )
}
