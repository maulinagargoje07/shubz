"use client"

import Link from "next/link"
import { cn } from "cn"

import { formatValue, type Unit } from "./palette"
import { useMounted } from "./support"

/*
 * One whole split into parts: a thin bar, each part its share of the width,
 * with a 2px gap between parts, and the figures listed beneath it (a swatch,
 * the name, the amount, the share). A part at zero draws nothing but still
 * appears in the list, so a plan nobody bought this month is still a row.
 */

export type Part = {
  key: string
  label: string
  value: number
  color: string
  /** A second figure for the row, e.g. the rupees behind a count. */
  detail?: string
  hint?: string
  href?: string
}

export function SegmentedBar({
  parts,
  unit,
  className,
  thickness = 10,
  list = true,
}: {
  parts: Part[]
  unit: Unit
  className?: string
  thickness?: number
  /** Show the figures under the bar. */
  list?: boolean
}) {
  const mounted = useMounted()
  const total = parts.reduce((sum, part) => sum + Math.max(0, part.value), 0)
  const share = (part: Part) => (total > 0 ? part.value / total : 0)

  return (
    <div className={className}>
      <div
        className="flex w-full gap-0.5 overflow-hidden rounded-full bg-[var(--chart-track)]"
        style={{ height: thickness }}
        role="img"
        aria-label={parts.map((p) => `${p.label} ${formatValue(p.value, unit)}`).join(", ")}
      >
        {total === 0 ? null : (
          parts.map((part) =>
            part.value > 0 ? (
              <div
                key={part.key}
                title={`${part.label}: ${formatValue(part.value, unit)} (${Math.round(share(part) * 100)}%)`}
                className="h-full rounded-sm transition-[width,filter] duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:brightness-125"
                style={{ width: mounted ? `${share(part) * 100}%` : "0%", background: part.color }}
              />
            ) : null
          )
        )}
      </div>

      {list ? (
        <ul className="mt-3 divide-y divide-border/50">
          {parts.map((part) => {
            const body = (
              <>
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: part.color }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{part.label}</span>
                  {part.hint ? <span className="block truncate text-xs text-muted-foreground">{part.hint}</span> : null}
                </span>
                <span className="text-right">
                  <span className="block text-sm font-semibold tabular-nums text-foreground">{formatValue(part.value, unit)}</span>
                  {part.detail ? <span className="block text-xs tabular-nums text-muted-foreground">{part.detail}</span> : null}
                </span>
                <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {total > 0 ? `${Math.round(share(part) * 100)}%` : "—"}
                </span>
              </>
            )
            const rowClass = "flex items-center gap-3 py-2"
            return (
              <li key={part.key}>
                {part.href ? (
                  <Link href={part.href} className={cn(rowClass, "group -mx-2 rounded-lg px-2 transition-colors hover:bg-[var(--glass-fill-flat)]")}>
                    {body}
                  </Link>
                ) : (
                  <div className={rowClass}>{body}</div>
                )}
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
