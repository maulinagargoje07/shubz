"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "cn"

/*
 * The interactive half of the liquid-glass look. Both are tiny client
 * components so the pages themselves stay server-rendered:
 *
 *   GlassPane       a pane that lifts toward the pointer, carries a light
 *                   under it, swings its rim's bright pole toward the cursor
 *                   and, if asked, draws a lens round its edge (desktop only;
 *                   a phone just gets the glass).
 *   AnimatedNumber  a figure that counts up when it first appears and ticks
 *                   to its new value when a refresh changes it, so a payment
 *                   landing is something you see happen.
 */

export function GlassPane({
  as: Tag = "div",
  tilt,
  lens = false,
  className,
  children,
  ...rest
}: {
  as?: "div" | "section" | "article"
  /**
   * Accepted for older call sites and ignored: Liquid Glass lifts and
   * brightens, it never tilts (and a 3D transform on a blurred element makes
   * Safari re-rasterise it every frame).
   */
  tilt?: number
  /** Draw the edge lens (a second backdrop filter: hero panes only). */
  lens?: boolean
  className?: string
  children: React.ReactNode
} & Omit<React.HTMLAttributes<HTMLElement>, "className" | "children">) {
  const ref = useRef<HTMLElement | null>(null)
  // Read so older call sites that still pass `tilt` neither warn nor tilt.
  void tilt
  // A phone never hovers, so it never pays for the per-move style writes.
  const coarse = useRef(false)
  useEffect(() => {
    coarse.current = window.matchMedia("(pointer: coarse)").matches
  }, [])

  const onMove = (event: React.PointerEvent<HTMLElement>) => {
    const el = ref.current
    if (!el || coarse.current || event.pointerType !== "mouse") return
    const box = el.getBoundingClientRect()
    const x = event.clientX - box.left
    const y = event.clientY - box.top
    el.style.setProperty("--mx", `${((x / box.width) * 100).toFixed(1)}%`)
    el.style.setProperty("--my", `${((y / box.height) * 100).toFixed(1)}%`)
    // Where the light is, as the rim's conic gradient counts angles: 0deg at
    // the top, clockwise. The bright pole of the rim swings toward the cursor.
    const angle = (Math.atan2(y - box.height / 2, x - box.width / 2) * 180) / Math.PI + 90
    el.style.setProperty("--light-angle", `${((angle + 360) % 360).toFixed(1)}deg`)
  }

  const onLeave = () => {
    const el = ref.current
    if (!el) return
    el.style.setProperty("--light-angle", "315deg")
  }

  return (
    <Tag
      ref={ref as React.RefObject<HTMLDivElement>}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={cn("glass glass-live", className)}
      {...rest}
    >
      <span className="glass-spot" aria-hidden />
      {lens ? <span className="glass-ring" aria-hidden /> : null}
      {children}
    </Tag>
  )
}

/** The digits in "₹48,689", "22.2%" or "8", with whatever sits around them. */
function split(text: string): { prefix: string; value: number; decimals: number; suffix: string } | null {
  const match = /^([^\d-]*)(-?[\d,]+(?:\.\d+)?)(.*)$/.exec(text.trim())
  if (!match) return null
  const [, prefix, digits, suffix] = match
  const value = Number(digits.replace(/,/g, ""))
  if (!Number.isFinite(value)) return null
  const decimals = digits.includes(".") ? digits.split(".")[1]!.length : 0
  return { prefix, value, decimals, suffix }
}

const format = (value: number, decimals: number) =>
  value.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })

export function AnimatedNumber({ value, className }: { value: string; className?: string }) {
  const parts = split(value)
  // The built page carries the real figure (so nothing depends on JavaScript
  // to be correct) but keeps it invisible until the count-up starts, so the
  // reader never sees it jump back to zero.
  const [shown, setShown] = useState(value)
  const [mounted, setMounted] = useState(false)
  const previous = useRef<number | null>(null)
  const frame = useRef<number | null>(null)

  useEffect(() => {
    setMounted(true)
    if (!parts) {
      setShown(value)
      return
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const first = previous.current === null
    const from = previous.current ?? 0
    const to = parts.value
    previous.current = to
    if (reduced || from === to) {
      setShown(value)
      return
    }
    const start = performance.now()
    const duration = first ? 900 : 650
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      const current = from + (to - from) * eased
      setShown(`${parts.prefix}${format(t === 1 ? to : current, parts.decimals)}${parts.suffix}`)
      if (t < 1) frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current)
    }
    // Re-run only when the figure itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <span className={cn("transition-opacity duration-300", mounted ? "opacity-100" : "opacity-0", className)} data-value={value}>
      {shown}
    </span>
  )
}
