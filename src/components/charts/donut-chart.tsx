"use client"

import Link from "next/link"
import { useId, useState } from "react"
import { cn } from "cn"

import { formatValue, type Unit } from "./palette"
import type { Part } from "./segmented-bar"
import { useMounted, useReducedMotion } from "./support"

/*
 * One whole split into parts, as a ring: each part an arc of the ring, its
 * share of the way round, starting at twelve o'clock and going clockwise in
 * the order given, with a figure and a word in the middle. A 2.5° gap sits
 * between the arcs and their ends are flat, so the gaps read as gaps rather
 * than as rounded caps overlapping. A part at zero draws nothing but still
 * appears in the list under the ring (the same list as the segmented bar).
 *
 * When the ring first appears each arc sweeps in, one a beat after the next,
 * the way the ring meter does. Pointing at an arc, or at its row in the list,
 * lifts it: the rest fade back, it glows its own colour and swells a touch,
 * and a tooltip above the ring gives the figure and the share.
 */

export type DonutChartProps = {
  parts: Part[]
  unit: Unit
  size?: number
  thickness?: number
  /** What sits in the middle: a figure and a word under it. */
  children?: React.ReactNode
  emptyText?: string
  /** List the parts under the ring. */
  legend?: boolean
  className?: string
}

/** Degrees of ring left clear between two arcs. */
const GAP = 2.5
/** The least an arc may shrink to, so a sliver of a part is still there to point at. */
const SLIVER = 0.75

/** A point on the ring, measured clockwise from twelve o'clock. */
function polar(cx: number, cy: number, r: number, deg: number): string {
  const rad = ((deg - 90) * Math.PI) / 180
  return `${(cx + r * Math.cos(rad)).toFixed(2)},${(cy + r * Math.sin(rad)).toFixed(2)}`
}

/**
 * An arc of `sweep` degrees from `start`. A full circle needs two arcs, since
 * one can't end where it began, and is closed so the ends meet in a join
 * rather than two butt caps with a hairline seam between them.
 */
function arcPath(cx: number, cy: number, r: number, start: number, sweep: number): string {
  if (sweep >= 360) {
    const top = polar(cx, cy, r, 0)
    const bottom = polar(cx, cy, r, 180)
    return `M${top} A${r},${r} 0 1 1 ${bottom} A${r},${r} 0 1 1 ${top} Z`
  }
  const from = polar(cx, cy, r, start)
  const to = polar(cx, cy, r, start + sweep)
  return `M${from} A${r},${r} 0 ${sweep > 180 ? 1 : 0} 1 ${to}`
}

export function DonutChart({
  parts,
  unit,
  size = 168,
  thickness = 18,
  children,
  emptyText = "Nothing to split yet.",
  legend = true,
  className,
}: DonutChartProps) {
  const mounted = useMounted()
  const reduced = useReducedMotion()
  const [active, setActive] = useState<string | null>(null)
  const id = useId()

  const total = parts.reduce((sum, part) => sum + Math.max(0, part.value), 0)
  const share = (part: Part) => (total > 0 ? Math.max(0, part.value) / total : 0)
  const percent = (part: Part) => `${Math.round(share(part) * 100)}%`

  const cx = size / 2
  const cy = size / 2
  const r = (size - thickness) / 2

  // The arcs: only the parts with something in them, in order, each after a gap.
  const drawn = parts.filter((part) => part.value > 0)
  const gap = drawn.length > 1 ? GAP : 0
  let cursor = 0
  const arcs = drawn.map((part, order) => {
    const span = share(part) * 360
    const sweep = Math.max(Math.min(span, SLIVER), span - gap)
    const start = cursor + (span - sweep) / 2
    cursor += span
    return { part, order, d: arcPath(cx, cy, r, start, sweep) }
  })

  const activePart = active !== null ? (parts.find((part) => part.key === active) ?? null) : null
  const tipId = `${id}-tip`

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="block overflow-visible">
          {total === 0 ? (
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--chart-track)" strokeWidth={thickness} aria-hidden />
          ) : (
            arcs.map(({ part, order, d }) => {
              const lifted = active === part.key
              return (
                <path
                  key={part.key}
                  d={d}
                  fill="none"
                  stroke={part.color}
                  strokeWidth={thickness}
                  strokeLinecap="butt"
                  pathLength={1}
                  strokeDasharray={1}
                  strokeDashoffset={mounted || reduced ? 0 : 1}
                  role="img"
                  aria-label={`${part.label} ${formatValue(part.value, unit)} (${percent(part)})`}
                  aria-describedby={tipId}
                  tabIndex={0}
                  className="cursor-pointer outline-none"
                  style={{
                    // Swell and glow from the arc's own centre.
                    transformBox: "fill-box",
                    transformOrigin: "center",
                    transform: lifted ? "scale(1.03)" : undefined,
                    opacity: active === null || lifted ? 1 : 0.45,
                    filter: lifted ? `drop-shadow(0 0 6px ${part.color})` : undefined,
                    transition: [
                      reduced ? null : `stroke-dashoffset 900ms cubic-bezier(0.2, 0.8, 0.2, 1) ${order * 70}ms`,
                      "opacity 150ms ease",
                      "transform 200ms ease",
                      "filter 200ms ease",
                    ]
                      .filter(Boolean)
                      .join(", "),
                  }}
                  onPointerEnter={() => setActive(part.key)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(part.key)}
                  onBlur={() => setActive(null)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setActive(null)
                  }}
                />
              )
            })
          )}
        </svg>

        {/* The middle. It must not catch the pointer, or the arcs under it never would. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          {total === 0 ? <p className="text-xs text-muted-foreground">{emptyText}</p> : children}
        </div>

        {activePart ? (
          <div
            id={tipId}
            role="tooltip"
            className="viz-tip"
            style={{ left: cx, top: -4, transform: "translate(-50%, -100%)" }}
          >
            <p className="mb-1 flex items-center gap-2 font-medium text-foreground">
              <span className="size-2 shrink-0 rounded-full" style={{ background: activePart.color }} aria-hidden />
              {activePart.label}
            </p>
            <p className="whitespace-nowrap text-muted-foreground">
              <span className="font-semibold tabular-nums text-foreground">{formatValue(activePart.value, unit)}</span>
              {total > 0 ? <span className="tabular-nums"> · {percent(activePart)}</span> : null}
            </p>
          </div>
        ) : null}
      </div>

      {legend ? (
        <ul className="mt-3 w-full divide-y divide-border/50">
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
                  {total > 0 ? percent(part) : "—"}
                </span>
              </>
            )
            const rowClass = cn(
              "-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors",
              active === part.key && "bg-[var(--glass-fill-flat)]"
            )
            return (
              <li
                key={part.key}
                onPointerEnter={() => setActive(part.key)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(part.key)}
                onBlur={() => setActive(null)}
              >
                {part.href ? (
                  <Link href={part.href} className={cn(rowClass, "group hover:bg-[var(--glass-fill-flat)]")}>
                    {body}
                  </Link>
                ) : (
                  <div className={rowClass}>{body}</div>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        /* Without the legend, the figures as a list for screen readers. */
        <ul className="sr-only">
          {parts.map((part) => (
            <li key={part.key}>
              {part.label}: {formatValue(part.value, unit)}
              {total > 0 ? ` (${percent(part)})` : ""}
              {part.detail ? `, ${part.detail}` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
