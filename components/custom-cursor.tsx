"use client"

import { useEffect, useRef, useState } from "react"

export function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null)
  const [isEnabled, setIsEnabled] = useState(false)
  const [isClicking, setIsClicking] = useState(false)
  const [isHovering, setIsHovering] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 769px)")
    const updateCursorAvailability = () => setIsEnabled(mediaQuery.matches)

    updateCursorAvailability()
    mediaQuery.addEventListener("change", updateCursorAvailability)

    return () => {
      mediaQuery.removeEventListener("change", updateCursorAvailability)
    }
  }, [])

  useEffect(() => {
    if (!isEnabled) return

    const cursor = cursorRef.current
    if (!cursor) return

    // 직접 DOM 조작으로 지연 시간 최소화
    const handleMouseMove = (e: MouseEvent) => {
      cursor.style.left = e.clientX + "px"
      cursor.style.top = e.clientY + "px"
    }

    const handleMouseDown = () => setIsClicking(true)
    const handleMouseUp = () => setIsClicking(false)

    // 호버 가능한 요소들 감지
    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const isInteractive = target.matches('a, button, [role="button"], .cursor-pointer, input, textarea, select')
      setIsHovering(isInteractive)
    }

    // 패시브 이벤트 리스너로 성능 향상
    document.addEventListener("mousemove", handleMouseMove, { passive: true })
    document.addEventListener("mousedown", handleMouseDown, { passive: true })
    document.addEventListener("mouseup", handleMouseUp, { passive: true })
    document.addEventListener("mouseover", handleMouseOver, { passive: true })

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mousedown", handleMouseDown)
      document.removeEventListener("mouseup", handleMouseUp)
      document.removeEventListener("mouseover", handleMouseOver)
    }
  }, [isEnabled])

  if (!isEnabled) {
    return null
  }

  return (
    <div
      ref={cursorRef}
      className={`fixed pointer-events-none z-[9999] transition-all duration-75 ease-out mix-blend-difference ${
        isClicking
          ? "w-8 h-8 bg-accent-orange border-2 border-accent-orange"
          : isHovering
            ? "w-12 h-12 border-2 border-accent-orange bg-accent-orange/20"
            : "w-10 h-10 border-2 border-accent-orange"
      } rounded-full`}
      style={{
        left: "-100px",
        top: "-100px",
        transform: "translate(-50%, -50%)",
        willChange: "transform",
        backfaceVisibility: "hidden",
      }}
    />
  )
}
