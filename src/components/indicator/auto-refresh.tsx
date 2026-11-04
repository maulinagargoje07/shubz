"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "cn"

/**
 * Keeps an Indicator page current without anyone pressing reload, and says so.
 *
 * Every few seconds, while the tab is in view, the page asks the server for a
 * fresh render. Next.js swaps the new data in place: filters typed into the
 * search box, scroll position and open menus all stay as they were. A hidden
 * tab doesn't poll, and comes back up to date the moment it's looked at.
 *
 * The badge shows "Live" with a pulse, and how long ago the figures on screen
 * were produced — ticking, so a page that has stopped updating is visibly
 * stale rather than quietly wrong.
 */
export function AutoRefresh({
  updatedLabel,
  generatedAt,
  intervalMs = 10_000,
  retrying = false,
}: {
  /** The render time, formatted on the server so it matches after hydration. */
  updatedLabel: string
  /** When the figures were produced (ISO), for the ticking "12s ago". */
  generatedAt?: string
  intervalMs?: number
  /** True while the page is showing an error and polling for recovery. */
  retrying?: boolean
}) {
  const router = useRouter()
  const [ago, setAgo] = useState<string | null>(null)

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

  // "just now" → "8s ago" → "2m ago": the same figure on the server and on the
  // first client paint (the formatted time), then the ticking version.
  useEffect(() => {
    if (!generatedAt) return
    const at = new Date(generatedAt).getTime()
    if (Number.isNaN(at)) return
    const tick = () => {
      const seconds = Math.max(0, Math.round((Date.now() - at) / 1000))
      setAgo(seconds < 3 ? "just now" : seconds < 60 ? `${seconds}s ago` : `${Math.floor(seconds / 60)}m ago`)
    }
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [generatedAt])

  return (
    <p
      className="glass-tint inline-flex items-center gap-2 rounded-full py-1 pr-3 pl-2 text-xs text-muted-foreground"
      title={`Updates by itself every ${Math.round(intervalMs / 1000)} seconds · last at ${updatedLabel}`}
    >
      <span className="relative flex size-2" aria-hidden>
        <span className={cn("absolute inline-flex size-full animate-ping rounded-full", retrying ? "bg-pending/60" : "bg-paid/60")} />
        <span className={cn("relative inline-flex size-2 rounded-full", retrying ? "bg-pending" : "bg-paid")} />
      </span>
      <span className={cn("font-semibold uppercase tracking-wider", retrying ? "text-pending-foreground" : "text-paid-foreground")}>
        {retrying ? "Retrying" : "Live"}
      </span>
      <span className="tabular-nums">{ago ? `updated ${ago}` : `updated ${updatedLabel}`}</span>
    </p>
  )
}
