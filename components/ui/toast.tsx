"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

const Toast = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    open?: boolean
    onOpenChange?: (open: boolean) => void
  }
>(({ className, open = true, ...props }, ref) => {
  if (!open) return null

  return (
    <div
      ref={ref}
      role="status"
      className={cn(
        "rounded-md border bg-background px-4 py-3 text-foreground shadow",
        className
      )}
      {...props}
    />
  )
})
Toast.displayName = "Toast"

const ToastAction = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "inline-flex h-8 items-center justify-center rounded-md border px-3 text-sm font-medium",
      className
    )}
    {...props}
  />
))
ToastAction.displayName = "ToastAction"

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>
type ToastActionElement = React.ReactElement<typeof ToastAction>

export { Toast, ToastAction }
export type { ToastActionElement, ToastProps }
