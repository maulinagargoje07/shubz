"use client"

import { useId, useState } from "react"
import { cn } from "cn"

import { formatShort, formatValue, niceScale, type Unit } from "./palette"
import { useReducedMotion, useWidth } from "./support"

/*
 * A line over time with a wash under it: one series, several laid over each
 * other, or several stacked.
 *
 * The line is a monotone cubic — it bends through the points but never
 * overshoots them, so a flat week stays flat and a zero stays on the axis —
 * 2.5px with round joins. Under it a gradient of the same colour fades to
 * nothing at the baseline, so the eye reads the area without the colour
 * drowning the gridlines. Hairline gridlines and tick labels as the column
 * chart has them; the peak labelled on the chart; a dot on the last point of
 * each series. One transparent rectangle over the plot catches the pointer
 * (a finger dragging across it scrubs), picks the nearest point and shows a
 * crosshair and the tooltip; the same rectangle takes keyboard focus and the
 * arrow keys walk the points. A screen reader gets the whole thing as a table.
 *
 * When the line first appears it draws itself (pathLength=1 and .viz-draw)
 * and the wash fades in; new data just re-renders the same elements, so
 * nothing replays.
 */

export type AreaSeries = { name: string; color: string }

export type AreaPoint = {
  /** The axis label, e.g. "4 Nov" or "Nov 26". */
  label: string
  /** The tooltip's heading, e.g. "4 November 2026". Defaults to the label. */
  title?: string
  /** One value per series, in series order. */
  values: number[]
}

export type AreaChartProps = {
  points: AreaPoint[]
  series: AreaSeries[]
  unit: Unit
  height?: number
  /** Pile the series on each other, so the top line is the total. Off: each series its own line. */
  stacked?: boolean
  emptyText?: string
  className?: string
  /** Draw the x axis line. */
  baseline?: boolean
}

const TOP = 14
const BOTTOM = 26
const RIGHT = 10
const LINE = 2.5

type XY = { x: number; y: number }
type Segment = { c1: XY; c2: XY; p: XY }

const f = (n: number) => n.toFixed(1)
const at = (p: XY) => `${f(p.x)},${f(p.y)}`

/**
 * The tangent at each point, chosen the way d3's curveMonotoneX chooses them:
 * never steeper than the gentler of the two neighbouring secants, and flat at
 * a turn, which is what keeps the curve between its points.
 */
function tangents(pts: XY[]): number[] {
  const n = pts.length
  const t = new Array<number>(n).fill(0)
  if (n < 2) return t
  const secant = (i: number) => {
    const h = pts[i + 1].x - pts[i].x
    return h === 0 ? 0 : (pts[i + 1].y - pts[i].y) / h
  }
  for (let i = 1; i < n - 1; i++) {
    const h0 = pts[i].x - pts[i - 1].x
    const h1 = pts[i + 1].x - pts[i].x
    const s0 = secant(i - 1)
    const s1 = secant(i)
    const p = h0 + h1 === 0 ? 0 : (s0 * h1 + s1 * h0) / (h0 + h1)
    t[i] = (Math.sign(s0) + Math.sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0
  }
  // The ends: a one-sided estimate from the first secant and the neighbouring tangent.
  t[0] = n > 2 ? (3 * secant(0) - t[1]) / 2 : secant(0)
  t[n - 1] = n > 2 ? (3 * secant(n - 2) - t[n - 2]) / 2 : secant(n - 2)
  return t
}

/** The cubic pieces between consecutive points. */
function segments(pts: XY[]): Segment[] {
  const t = tangents(pts)
  const out: Segment[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = (pts[i + 1].x - pts[i].x) / 3
    out.push({
      c1: { x: pts[i].x + dx, y: pts[i].y + dx * t[i] },
      c2: { x: pts[i + 1].x - dx, y: pts[i + 1].y - dx * t[i + 1] },
      p: pts[i + 1],
    })
  }
  return out
}

/** The line, start to end. */
function linePath(pts: XY[]): string {
  if (pts.length === 0) return ""
  return `M${at(pts[0])}` + segments(pts).map((s) => ` C${at(s.c1)} ${at(s.c2)} ${at(s.p)}`).join("")
}

/**
 * The same curve walked backwards, without the leading M, so it can close a
 * region whose top is another curve. A cubic reversed is the same cubic with
 * its control points swapped.
 */
function returnPath(pts: XY[]): string {
  const segs = segments(pts)
  let d = ` L${at(pts[pts.length - 1])}`
  for (let i = segs.length - 1; i >= 0; i--) {
    const from = i === 0 ? pts[0] : segs[i - 1].p
    d += ` C${at(segs[i].c2)} ${at(segs[i].c1)} ${at(from)}`
  }
  return d
}

export function AreaChart({
  points,
  series,
  unit,
  height = 224,
  stacked = false,
  emptyText = "Nothing in this period yet.",
  className,
  baseline = true,
}: AreaChartProps) {
  const { ref, width } = useWidth<HTMLDivElement>()
  const reduced = useReducedMotion()
  const [active, setActive] = useState<number | null>(null)
  const id = useId()

  const n = points.length
  // The level each series draws at every point: its own value, or (stacked) the running sum.
  const levels = series.map((_, s) =>
    points.map((p) => {
      if (!stacked) return p.values[s] ?? 0
      let sum = 0
      for (let k = 0; k <= s; k++) sum += p.values[k] ?? 0
      return sum
    })
  )
  const totals = points.map((p) => p.values.reduce((a, b) => a + b, 0))
  let max = 0
  let peak = { s: -1, i: -1 }
  levels.forEach((row, s) =>
    row.forEach((v, i) => {
      if (v > max) {
        max = v
        peak = { s, i }
      }
    })
  )

  const scale = niceScale(max, unit)
  const top = scale.step * scale.ticks
  const ticks = Array.from({ length: scale.ticks + 1 }, (_, i) => i * scale.step)
  const tickLabels = ticks.map((t) => formatShort(t, unit))
  const left = Math.max(...tickLabels.map((t) => t.length)) * 7 + 10

  const plotWidth = Math.max(0, width - left - RIGHT)
  const plotHeight = height - TOP - BOTTOM
  const axisY = TOP + plotHeight
  const x = (i: number) => (n > 1 ? left + (i / (n - 1)) * plotWidth : left + plotWidth / 2)
  const y = (value: number) => axisY - (value / top) * plotHeight

  // Axis labels: as many as fit at ~44px each, always including the last.
  const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(plotWidth / 44))))
  const showLabel = (i: number) => (n - 1 - i) % every === 0

  // Each series as a line and the region under it, down to the series beneath (stacked) or the axis.
  const curves = series.map((s, si) => {
    const pts = levels[si].map((v, i) => ({ x: x(i), y: y(v) }))
    const line = linePath(pts)
    const floor = stacked && si > 0 ? levels[si - 1].map((v, i) => ({ x: x(i), y: y(v) })) : null
    const area =
      n === 0
        ? ""
        : floor
          ? `${line}${returnPath(floor)} Z`
          : `${line} L${f(x(n - 1))},${f(axisY)} L${f(x(0))},${f(axisY)} Z`
    return { ...s, si, pts, line, area }
  })

  const hovered = active !== null ? points[active] : null
  const tipY = active !== null ? Math.min(...levels.map((row) => y(row[active]))) - 14 : 0

  const pick = (e: React.PointerEvent<SVGRectElement>) => {
    if (n === 0) return
    const box = e.currentTarget.getBoundingClientRect()
    const t = box.width > 0 ? (e.clientX - box.left) / box.width : 0
    setActive(Math.min(n - 1, Math.max(0, Math.round(t * (n - 1)))))
  }

  const onKeyDown = (e: React.KeyboardEvent<SVGRectElement>) => {
    if (n === 0) return
    const current = active ?? n - 1
    let next: number | null
    switch (e.key) {
      case "ArrowLeft":
        next = current - 1
        break
      case "ArrowRight":
        next = current + 1
        break
      case "Home":
        next = 0
        break
      case "End":
        next = n - 1
        break
      case "Escape":
        next = null
        break
      default:
        return
    }
    e.preventDefault()
    setActive(next === null ? null : Math.min(n - 1, Math.max(0, next)))
  }

  return (
    <div ref={ref} className={cn("relative", className)} style={{ height }}>
      {width > 0 ? (
        <svg width={width} height={height} className="block overflow-visible" aria-hidden>
          <defs>
            {series.map((s, si) => (
              <linearGradient key={s.name} id={`${id}-wash-${si}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>

          {/* gridlines and ticks */}
          {ticks.map((tick, i) => (
            <g key={tick}>
              {i > 0 || baseline ? (
                <line
                  x1={left}
                  x2={left + plotWidth}
                  y1={y(tick)}
                  y2={y(tick)}
                  stroke={i === 0 ? "var(--chart-axis)" : "var(--chart-grid)"}
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
              ) : null}
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

          {/* the series, back to front, so the first one sits on top; nothing when every value is 0 */}
          {[...curves].reverse().map((curve) =>
            n > 0 && max > 0 ? (
              <g key={curve.name}>
                <path d={curve.area} fill={`url(#${id}-wash-${curve.si})`} className={reduced ? undefined : "viz-fade"} />
                <path
                  d={curve.line}
                  fill="none"
                  stroke={curve.color}
                  strokeWidth={LINE}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  pathLength={1}
                  className={reduced ? undefined : "viz-draw"}
                />
              </g>
            ) : null
          )}

          {/* the last point of each series */}
          {n > 0 && max > 0
            ? curves.map((curve) => (
                <circle
                  key={curve.name}
                  cx={curve.pts[n - 1].x}
                  cy={curve.pts[n - 1].y}
                  r={4}
                  fill={curve.color}
                  stroke="var(--card)"
                  strokeWidth={2}
                  className={reduced ? undefined : "viz-fade"}
                />
              ))
            : null}

          {/* the peak, labelled */}
          {peak.i >= 0 ? (
            <text
              x={x(peak.i)}
              y={y(max) - 8}
              textAnchor="middle"
              className={cn("fill-foreground tabular-nums", reduced ? undefined : "viz-fade")}
              fontSize={11}
              fontWeight={600}
            >
              {formatShort(max, unit)}
            </text>
          ) : null}

          {/* x labels */}
          {points.map((point, i) =>
            showLabel(i) ? (
              <text
                key={point.label}
                x={x(i)}
                y={axisY + 16}
                textAnchor="middle"
                className="fill-muted-foreground"
                fontSize={10}
              >
                {point.label}
              </text>
            ) : null
          )}

          {/* crosshair at the active point */}
          {active !== null ? (
            <g className="pointer-events-none">
              <line x1={x(active)} x2={x(active)} y1={TOP} y2={axisY} stroke="var(--chart-axis)" strokeWidth={1} shapeRendering="crispEdges" />
              {curves.map((curve) => (
                <g key={curve.name}>
                  <circle cx={x(active)} cy={curve.pts[active].y} r={10} fill={curve.color} opacity={0.3} />
                  <circle cx={x(active)} cy={curve.pts[active].y} r={5} fill={curve.color} stroke="var(--card)" strokeWidth={2} />
                </g>
              ))}
            </g>
          ) : null}

          {/* the hit target: the whole plot. pan-y keeps a vertical finger drag for scrolling. */}
          <rect
            x={left}
            y={TOP}
            width={plotWidth}
            height={plotHeight}
            fill="transparent"
            tabIndex={0}
            aria-describedby={`${id}-tip`}
            onPointerMove={pick}
            onPointerDown={pick}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive((a) => a ?? n - 1)}
            onBlur={() => setActive(null)}
            onKeyDown={onKeyDown}
            className="cursor-crosshair touch-pan-y outline-none"
          />
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
            left: Math.min(Math.max(x(active), 72), width - 72),
            top: Math.max(0, tipY),
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
                {series.map((s, si) => (
                  <td key={s.name}>{formatValue(point.values[si] ?? 0, unit)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
