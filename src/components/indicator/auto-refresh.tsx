"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/**
 * Keeps an Indicator page current without anyone pressing reload.
 *
 * Every few seconds, while the tab is in view, the page asks the server for a
 * fresh render. Next.js swaps the new data in place: filters typed into the
 * search box, scroll position and open menus all stay as they were. A hidden
 * tab doesn't poll, and comes back up to date the moment it's looked at.
 */
export function AutoRefresh({
  updatedLabel,
  intervalMs = 10_000,
}: {
  /** The render time, formatted on the server so it matches after hydration. */
  updatedLabel: string
  intervalMs?: number
}) {
  const router = useRouter()

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh()
    }
    const timer = window.setInterval(refresh, intervalMs)
    document.addEventListener("visibilitychange", refresh)
    window.addEventListener("online", refresh)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", refresh)
      window.removeEventListener("online", refresh)
    }
  }, [router, intervalMs])

  return (
    <p
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
      title={`Updates by itself every ${Math.round(intervalMs / 1000)} seconds`}
    >
      <span className="relative flex size-2" aria-hidden>
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-paid/60" />
        <span className="relative inline-flex size-2 rounded-full bg-paid" />
      </span>
      Updated {updatedLabel}
    </p>
  )
}
