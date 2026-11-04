"use client"

import { useId, useState } from "react"
import { cn } from "cn"

import { formatShort, formatValue, niceScale, type Unit } from "./palette"
import { useWidth } from "./support"

/*
 * Columns over time: one series, or several stacked.
 *
 * Thin marks (never wider than 24px) with a rounded cap, growing out of the
 * baseline; hairline gridlines; the biggest column labelled on its cap and
 * every other value one hover away. Each slot is a hit target the full height
 * of the plot, and keyboard focus shows the same tooltip as the pointer. A
 * screen reader gets the whole thing as a table.
 */

export type ColumnSeries = { name: string; color: string }

export type ColumnPoint = {
  /** The axis label, e.g. "4 Nov" or "Nov 26". */
  label: string
  /** The tooltip's heading, e.g. "4 November 2026". Defaults to the label. */
  title?: string
  /** One value per series, in series order. */
  values: number[]
}

const TOP = 14
const BOTTOM = 26
const RIGHT = 10
const MAX_BAR = 24
const GAP = 2

export function ColumnChart({
  points,
  series,
  unit,
  height = 224,
  emptyText = "Nothing in this period yet.",
  className,
}: {
  points: ColumnPoint[]
  series: ColumnSeries[]
  unit: Unit
  height?: number
  emptyText?: string
  className?: string
}) {
  const { ref, width } = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)
  const id = useId()

  const totals = points.map((p) => p.values.reduce((a, b) => a + b, 0))
  const max = Math.max(0, ...totals)
  const scale = niceScale(max, unit)
  const top = scale.step * scale.ticks
  const ticks = Array.from({ length: scale.ticks + 1 }, (_, i) => i * scale.step)
  const tickLabels = ticks.map((t) => formatShort(t, unit))
  const left = Math.max(...tickLabels.map((t) => t.length)) * 7 + 10

  const plotWidth = Math.max(0, width - left - RIGHT)
  const plotHeight = height - TOP - BOTTOM
  const baseline = TOP + plotHeight
  const n = points.length
  const slot = n > 0 ? plotWidth / n : 0
  const bar = Math.min(MAX_BAR, slot * 0.62)
  const y = (value: number) => baseline - (value / top) * plotHeight

  // Axis labels: as many as fit at ~44px each, always including the last.
  const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(plotWidth / 44))))
  const showLabel = (i: number) => (n - 1 - i) % every === 0

  const peak = max > 0 ? totals.indexOf(max) : -1
  const hovered = active !== null ? points[active] : null

  return (
    <div ref={ref} className={cn("relative", className)} style={{ height }}>
      {width > 0 ? (
        <svg width={width} height={height} className="block overflow-visible" aria-hidden>
          {/* gridlines and ticks */}
          {ticks.map((tick, i) => (
            <g key={tick}>
              <line
                x1={left}
                x2={left + plotWidth}
                y1={y(tick)}
                y2={y(tick)}
                stroke={i === 0 ? "var(--chart-axis)" : "var(--chart-grid)"}
                strokeWidth={1}
                shapeRendering="crispEdges"
              />
              <text
                x={left - 8}
                y={y(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-muted-foreground tabular-nums"
                fontSize={10}
              >
                {tickLabels[i]}
              </text>
            </g>
          ))}

          {/* columns */}
          {points.map((point, i) => {
            const x = left + slot * i + (slot - bar) / 2
            let cursor = baseline
            const segments = point.values.map((value, s) => {
              const h = (value / top) * plotHeight
              const segment = { s, value, yTop: cursor - h, yBottom: cursor }
              cursor -= h
              return segment
            })
            // Which segment is drawn on top (it gets the rounded cap).
            const topIndex = [...segments].reverse().find((seg) => seg.value > 0)?.s ?? -1
            return (
              <g key={point.label} className="viz-grow" style={{ "--i": i } as React.CSSProperties}>
                {segments.map((seg) => {
                  if (seg.value <= 0) return null
                  const isTop = seg.s === topIndex
                  const isBottom = seg.s === segments.findIndex((s) => s.value > 0)
                  // A 2px gap between stacked segments; the baseline stays square.
                  const yBottom = isBottom ? seg.yBottom : seg.yBottom - GAP
                  const h = Math.max(0, yBottom - seg.yTop)
                  const r = isTop ? Math.min(4, bar / 2, h) : 0
                  const path = isTop
                    ? `M${x},${yBottom} V${seg.yTop + r} a${r},${r} 0 0 1 ${r},-${r} h${bar - 2 * r} a${r},${r} 0 0 1 ${r},${r} V${yBottom} Z`
                    : `M${x},${yBottom} V${seg.yTop} h${bar} V${yBottom} Z`
                  return (
                    <path
                      key={seg.s}
                      d={path}
                      fill={series[seg.s]?.color ?? "var(--chart-neutral)"}
                      className="transition-opacity duration-150"
                      opacity={active === null || active === i ? 1 : 0.45}
                    />
                  )
                })}
              </g>
            )
          })}

          {/* the biggest column, labelled on its cap */}
          {peak >= 0 && slot >= 18 ? (
            <text
              x={left + slot * peak + slot / 2}
              y={y(totals[peak]) - 6}
              textAnchor="middle"
              className="fill-foreground tabular-nums viz-fade"
              fontSize={11}
              fontWeight={600}
            >
              {formatShort(totals[peak], unit)}
            </text>
          ) : null}

          {/* x labels */}
          {points.map((point, i) =>
            showLabel(i) ? (
              <text
                key={point.label}
                x={left + slot * i + slot / 2}
                y={baseline + 16}
                textAnchor="middle"
                className="fill-muted-foreground"
                fontSize={10}
              >
                {point.label}
              </text>
            ) : null
          )}

          {/* hit targets: the whole slot, the whole plot height */}
          {points.map((point, i) => (
            <rect
              key={point.label}
              x={left + slot * i}
              y={TOP}
              width={Math.max(0, slot)}
              height={plotHeight}
              fill={active === i ? "var(--glass-fill-flat)" : "transparent"}
              rx={6}
              tabIndex={0}
              aria-describedby={`${id}-tip`}
              onPointerEnter={() => setActive(i)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className="cursor-crosshair outline-none"
            />
          ))}
        </svg>
      ) : null}

      {max === 0 && width > 0 ? (
        <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-xs text-muted-foreground">
          {emptyText}
        </p>
      ) : null}

      {hovered && active !== null && width > 0 ? (
        <div
          id={`${id}-tip`}
          role="tooltip"
          className="viz-tip"
          style={{
            left: Math.min(Math.max(left + slot * active + slot / 2, 72), width - 72),
            top: Math.max(0, y(totals[active]) - 10),
            transform: "translate(-50%, -100%)",
          }}
        >
          <p className="mb-1 font-medium text-foreground">{hovered.title ?? hovered.label}</p>
          {series.map((s, si) => (
            <p key={s.name} className="flex items-center gap-2 whitespace-nowrap text-muted-foreground">
              <span className="inline-block h-0.5 w-3 rounded-full" style={{ background: s.color }} aria-hidden />
              <span className="font-semibold tabular-nums text-foreground">{formatValue(hovered.values[si] ?? 0, unit)}</span>
              {series.length > 1 ? <span>{s.name}</span> : null}
            </p>
          ))}
          {series.length > 1 ? (
            <p className="mt-1 border-t border-border/60 pt-1 text-muted-foreground">
              <span className="font-semibold tabular-nums text-foreground">{formatValue(totals[active], unit)}</span> in all
            </p>
          ) : null}
        </div>
      ) : null}

      {/* The same figures as a table, for screen readers and anyone who prefers one. */}
      <div className="sr-only">
      <table>
        <thead>
          <tr>
            <th scope="col">Period</th>
            {series.map((s) => (
              <th key={s.name} scope="col">
                {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.label}>
              <th scope="row">{point.title ?? point.label}</th>
              {point.values.map((value, vi) => (
                <td key={vi}>{formatValue(value, unit)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}
