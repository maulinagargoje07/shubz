"use client"

import { cn } from "cn"

import { formatValue, type Unit } from "./palette"
import { useMounted } from "./support"

/*
 * Ranked horizontal bars: one per item, largest first, one hue, the value at
 * the tip. Bars on a shared baseline compare more exactly than slices of a
 * ring, which is why "which payment method do buyers use" is drawn this way.
 */

export type RankedItem = {
  key: string
  label: string
  value: number
  /** A second figure beside the value, e.g. the rupees behind a count. */
  detail?: string
}

export function RankedBars({
  items,
  unit,
  color = "var(--chart-3)",
  emptyText = "Nothing to rank yet.",
  className,
}: {
  items: RankedItem[]
  unit: Unit
  color?: string
  emptyText?: string
  className?: string
}) {
  const mounted = useMounted()
  const max = Math.max(0, ...items.map((item) => item.value))
  const total = items.reduce((sum, item) => sum + item.value, 0)

  if (items.length === 0 || max === 0) {
    return <p className={cn("py-6 text-center text-xs text-muted-foreground", className)}>{emptyText}</p>
  }

  return (
    <ul className={cn("space-y-3", className)}>
      {items.map((item) => {
        const share = total > 0 ? item.value / total : 0
        return (
          <li
            key={item.key}
            className="group"
            title={`${item.label}: ${formatValue(item.value, unit)} (${Math.round(share * 100)}%)`}
          >
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-medium text-foreground">{item.label}</span>
              <span className="shrink-0 tabular-nums">
                <span className="font-semibold text-foreground">{formatValue(item.value, unit)}</span>
                {item.detail ? <span className="ml-1.5 text-xs text-muted-foreground">{item.detail}</span> : null}
                <span className="ml-1.5 text-xs text-muted-foreground">{Math.round(share * 100)}%</span>
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--chart-track)]">
              <div
                className="viz-hbar h-full rounded-full transition-[filter] group-hover:brightness-125"
                style={{ width: mounted ? `${(item.value / max) * 100}%` : "0%", background: color }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
