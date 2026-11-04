"use client"

import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"

/*
 * A small sun/moon capsule in the corner of the sign-in page. It shares the
 * theme contract with the avatar menu: `localStorage.theme` is "light" or
 * "dark" and the html element carries the matching class (the inline script
 * in app/layout.tsx applies it before first paint). The server always
 * renders the dark icon and the effect corrects it, so markup never differs
 * between server and client.
 */
export function ThemeToggle() {
  const [dark, setDark] = useState(true)

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"))
  }, [])

  function toggle() {
    const next = !document.documentElement.classList.contains("dark")
    document.documentElement.classList.toggle("dark", next)
    document.documentElement.classList.toggle("light", !next)
    try {
      localStorage.setItem("theme", next ? "dark" : "light")
    } catch {
      // Private mode or blocked storage: the page still switches for now.
    }
    setDark(next)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Light theme" : "Dark theme"}
      className="glass-tint press fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-20 inline-flex size-9 min-h-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {dark ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
    </button>
  )
}
