"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"

export function RefreshButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
      className="px-5 py-2.5 border border-white/20 text-sm text-text-gray hover:text-white hover:border-white/50 transition-colors disabled:opacity-50"
    >
      {pending ? "새로고침 중…" : "상태 새로고침"}
    </button>
  )
}
