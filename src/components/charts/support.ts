"use client"

import { useEffect, useRef, useState } from "react"

/*
 * The hooks a chart needs to know its size, when it is on screen, and whether
 * the person has asked for less motion.
 */

/** The width of an element, kept current as the window resizes. 0 until measured. */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.getBoundingClientRect().width)
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setWidth(entry.contentRect.width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return { ref, width }
}

/** True once the component is on screen, so entrance animations only run there. */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(frame)
  }, [])
  return mounted
}

/**
 * True when the system asks for reduced motion. A chart then draws its final
 * state at once instead of growing, sweeping or fading in. (globals.css also
 * cuts every animation to 0.01ms under the same media query; this lets a chart
 * leave the animation classes off altogether, so nothing flickers through
 * that frame.) False on the server and until the first effect runs.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])
  return reduced
}
