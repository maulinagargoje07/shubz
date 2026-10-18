"use client"

import { useLinkStatus } from "next/link"
import { cn } from "cn"

/**
 * A small pulse inside a <Link> while the page it leads to is loading, so a
 * tap on a slow connection visibly registered. Renders nothing visible
 * otherwise. Must be placed inside the Link it reports on.
 *
 * This takes the place of route-level loading.tsx skeletons on the Indicator
 * pages; see the note in AGENTS.md on why those pages have none.
 */
export function LinkPending({ className }: { className?: string }) {
  const { pending } = useLinkStatus()
  return (
    <span
      aria-hidden
      className={cn(
        "size-1.5 shrink-0 rounded-full bg-primary transition-opacity duration-150",
        pending ? "animate-pulse opacity-100" : "opacity-0",
        className
      )}
    />
  )
}
