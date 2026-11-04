"use client"

import { useEffect } from "react"
import Image from "next/image"

/*
 * The scene behind the sign-in card: a large, faint, softly blurred copy of
 * the crown sitting a little below the card's centre, so the glass has
 * something to refract (clear in the middle, bright at the rim), and the
 * backdrop's two drifting glows easing a touch away from the pointer.
 *
 * It renders inside the card's wrapper at a negative z-index, which puts it
 * behind the card but in front of the wall, exactly where the card's
 * backdrop filter can see it.
 */
export function LoginScene() {
  useEffect(() => {
    // Desktop mice only: a phone has no pointer to follow, and someone who
    // asked for less motion gets a still wall.
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (!fine || reduced) return
    // The glows already drift on `transform`; `translate` is a separate
    // property, so the parallax composes with the drift instead of fighting it.
    const glows = Array.from(document.querySelectorAll<HTMLElement>(".aurora > span")).slice(0, 2)
    if (glows.length === 0) return
    for (const glow of glows) glow.style.transition = "translate 160ms ease-out"

    let frame = 0
    let x = 0
    let y = 0
    const paint = () => {
      frame = 0
      // 1.5% of the viewport, the opposite way to the pointer.
      const dx = (-x * 0.015 * window.innerWidth).toFixed(1)
      const dy = (-y * 0.015 * window.innerHeight).toFixed(1)
      for (const glow of glows) glow.style.translate = `${dx}px ${dy}px`
    }
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return
      x = event.clientX / window.innerWidth - 0.5
      y = event.clientY / window.innerHeight - 0.5
      if (!frame) frame = requestAnimationFrame(paint)
    }
    window.addEventListener("pointermove", onMove, { passive: true })
    return () => {
      window.removeEventListener("pointermove", onMove)
      if (frame) cancelAnimationFrame(frame)
      for (const glow of glows) {
        glow.style.translate = ""
        glow.style.transition = ""
      }
    }
  }, [])

  return (
    <Image
      src="/logo.png"
      alt=""
      aria-hidden
      width={420}
      height={420}
      priority={false}
      draggable={false}
      className="login-crown"
    />
  )
}
