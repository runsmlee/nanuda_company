"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"

import { cn } from "@/lib/utils"

function TooltipProvider({
  children,
}: React.PropsWithChildren<{ delayDuration?: number }>) {
  return <>{children}</>
}

function Tooltip({ children }: React.PropsWithChildren) {
  return <>{children}</>
}

const TooltipTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & { asChild?: boolean }
>(({ asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"

  return <Comp ref={ref} {...props} />
})
TooltipTrigger.displayName = "TooltipTrigger"

const TooltipContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    side?: "top" | "right" | "bottom" | "left"
    align?: "start" | "center" | "end"
  }
>(({ className, hidden, ...props }, ref) => {
  if (hidden) return null

  return (
    <div
      ref={ref}
      role="tooltip"
      className={cn(
        "z-50 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground shadow-md",
        className
      )}
      {...props}
    />
  )
})
TooltipContent.displayName = "TooltipContent"

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger }
