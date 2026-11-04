"use client"

import { format } from "date-fns"
import { useId, useState } from "react"
import { cn } from "cn"

import { formatValue, type Unit } from "./palette"
import { useReducedMotion, useWidth } from "./support"

/*
 * A day-by-day calendar, the way GitHub draws contributions: one square per
 * day, a column per week (Monday at the top, as an Indian calendar reads),
 * the weeks ending at today. A square's colour is the one hue at one of five
 * strengths — nothing is the faint track, and the rest step up by the rank
 * of the day among the non-zero days, so one big day doesn't wash out the
 * ordinary ones. Month names along the top where a month begins; Mon, Wed
 * and Fri down the side; a Less…More key at the bottom right.
 *
 * The weekday comes from the "yyyy-MM-dd" string by Date.UTC, so no time
 * zone can nudge a day into the wrong column; the date-fns format is only for
 * the words in a label. As many whole weeks as fit are shown (never fewer
 * than 8). The grid is one focusable thing: the arrow keys walk the days, and
 * hovering or focusing a square shows the day in a tooltip. A screen reader
 * gets the days as a table.
 */

export type HeatmapDay = {
  /** "yyyy-MM-dd". */
  day: string
  /** The short date, e.g. "4 Nov". */
  label: string
  value: number
  /** A second line for the tooltip, e.g. "3 purchases". */
  detail?: string
}

export type CalendarHeatmapProps = {
  /** Chronological; the last entry is today. */
  days: HeatmapDay[]
  unit: Unit
  color?: string
  /** The most weeks to show. */
  weeks?: number
  emptyText?: string
  className?: string
}

const CELL = 12
const GAP = 3
const STEP = CELL + GAP
/** Room for the weekday labels. */
const LEFT = 30
/** Room for the month labels. */
const TOP = 16
/** Room for the key under the grid. */
const KEY = 30
const MIN_WEEKS = 8
const OPACITY = [0.25, 0.45, 0.7, 1]
const DAY_MS = 86_400_000

/** Days since 1 Jan 1970, from "yyyy-MM-dd", by UTC so a time zone can't move it. */
function dayNumber(day: string): number {
  const [y, m, d] = day.split("-").map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS)
}
/** Back to "yyyy-MM-dd". */
const isoDay = (num: number) => new Date(num * DAY_MS).toISOString().slice(0, 10)
/** Monday-first weekday, 0 = Mon … 6 = Sun. Day 0 (1 Jan 1970) was a Thursday. */
const weekday = (num: number) => (((num + 3) % 7) + 7) % 7
/** Which Monday-to-Sunday week a day falls in. */
const weekIndex = (num: number) => Math.floor((num + 3) / 7)
/** The Monday that starts a week. */
const mondayOf = (week: number) => week * 7 - 3
/** Local midnight of a day, for date-fns to put words to; never for arithmetic. */
const asLocal = (day: string) => new Date(`${day}T00:00:00`)

export function CalendarHeatmap({
  days,
  unit,
  color = "var(--chart-1)",
  weeks = 16,
  emptyText = "Nothing on any day yet.",
  className,
}: CalendarHeatmapProps) {
  const { ref, width } = useWidth<HTMLDivElement>()
  const reduced = useReducedMotion()
  const [active, setActive] = useState<number | null>(null)
  const id = useId()

  const byDay = new Map(days.map((d) => [dayNumber(d.day), d]))
  const first = days.length > 0 ? dayNumber(days[0].day) : 0
  const today = days.length > 0 ? dayNumber(days[days.length - 1].day) : 0

  // As many whole weeks as fit, between 8 and `weeks`, ending at today's week.
  const fit = Math.floor((width - LEFT + GAP) / STEP)
  const cols = Math.min(weeks, Math.max(MIN_WEEKS, fit))
  const firstWeek = weekIndex(today) - cols + 1
  const mondays = Array.from({ length: cols }, (_, c) => mondayOf(firstWeek + c))
  const lowest = Math.max(first, mondays[0])
  const gridWidth = cols * STEP - GAP
  const gridHeight = 7 * STEP - GAP

  // The strength of a day: its mid-rank among the non-zero days, in four steps.
  const nonZero = days.map((d) => d.value).filter((v) => v > 0)
  const strength = (value: number): number => {
    if (value <= 0 || nonZero.length === 0) return -1
    let below = 0
    let equal = 0
    for (const other of nonZero) {
      if (other < value) below++
      else if (other === value) equal++
    }
    const rank = (2 * below + equal) / (2 * nonZero.length)
    return Math.min(OPACITY.length - 1, Math.floor(rank * OPACITY.length))
  }

  // Month labels at each column whose Monday is in a new month; the first
  // column's only if the next month isn't right on its heels.
  const monthOf = (num: number) => isoDay(num).slice(0, 7)
  const labelled = mondays
    .map((monday, c) => (c === 0 || monthOf(monday) !== monthOf(mondays[c - 1]) ? c : -1))
    .filter((c) => c >= 0)
  if (labelled.length > 1 && labelled[0] === 0 && labelled[1] < 3) labelled.shift()

  const cellX = (num: number) => LEFT + (weekIndex(num) - firstWeek) * STEP
  const cellY = (num: number) => TOP + weekday(num) * STEP

  const activeDay =
    active !== null ? (byDay.get(active) ?? { day: isoDay(active), label: "", value: 0 }) : null

  const onKeyDown = (e: React.KeyboardEvent<SVGSVGElement>) => {
    if (days.length === 0) return
    const current = active ?? today
    let next: number | null
    switch (e.key) {
      case "ArrowLeft":
        next = current - 1
        break
      case "ArrowRight":
        next = current + 1
        break
      case "ArrowUp":
        next = weekday(current) > 0 ? current - 1 : current
        break
      case "ArrowDown":
        next = weekday(current) < 6 ? current + 1 : current
        break
      case "Home":
        next = lowest
        break
      case "End":
        next = today
        break
      case "Escape":
        next = null
        break
      default:
        return
    }
    e.preventDefault()
    setActive(next === null ? null : Math.min(today, Math.max(lowest, next)))
  }

  if (days.length === 0) {
    return <p className={cn("py-6 text-center text-xs text-muted-foreground", className)}>{emptyText}</p>
  }

  const keyRight = LEFT + gridWidth
  const keyY = TOP + gridHeight + 12
  const keySquare = (k: number) => keyRight - 30 - (5 - k) * STEP

  return (
    <div ref={ref} className={cn("relative", className)}>
      {width > 0 ? (
        <svg
          width={LEFT + gridWidth}
          height={TOP + gridHeight + KEY}
          className="block max-w-full overflow-visible outline-none"
          role="group"
          aria-label="One square per day. The arrow keys move between days."
          aria-describedby={`${id}-tip`}
          tabIndex={0}
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive((a) => a ?? today)}
          onBlur={() => setActive(null)}
          onKeyDown={onKeyDown}
        >
          {/* month labels */}
          {labelled.map((c) => (
            <text key={c} x={LEFT + c * STEP} y={10} className="fill-muted-foreground" fontSize={10}>
              {format(asLocal(isoDay(mondays[c])), "MMM")}
            </text>
          ))}

          {/* weekday labels */}
          {(
            [
              [0, "Mon"],
              [2, "Wed"],
              [4, "Fri"],
            ] as const
          ).map(([row, name]) => (
            <text
              key={name}
              x={LEFT - 8}
              y={TOP + row * STEP + CELL / 2}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-muted-foreground"
              fontSize={10}
            >
              {name}
            </text>
          ))}

          {/* the days, a column per week, fading in column by column */}
          {mondays.map((monday, c) => (
            <g
              key={monday}
              className={reduced ? undefined : "viz-fade"}
              style={reduced ? undefined : { animationDelay: `${c * 20}ms` }}
            >
              {Array.from({ length: 7 }, (_, row) => {
                const num = monday + row
                if (num < first || num > today) return null
                const step = strength(byDay.get(num)?.value ?? 0)
                return (
                  <rect
                    key={row}
                    x={LEFT + c * STEP}
                    y={TOP + row * STEP}
                    width={CELL}
                    height={CELL}
                    rx={3}
                    fill={step < 0 ? "var(--chart-track)" : color}
                    fillOpacity={step < 0 ? 1 : OPACITY[step]}
                    stroke={active === num ? "var(--foreground)" : "none"}
                    strokeOpacity={0.6}
                    strokeWidth={1}
                    onPointerEnter={() => setActive(num)}
                  />
                )
              })}
            </g>
          ))}

          {/* the key */}
          <g className="fill-muted-foreground" fontSize={10}>
            <text x={keySquare(0) - 6} y={keyY + CELL / 2} textAnchor="end" dominantBaseline="middle">
              Less
            </text>
            {[-1, 0, 1, 2, 3].map((step, k) => (
              <rect
                key={step}
                x={keySquare(k)}
                y={keyY}
                width={CELL}
                height={CELL}
                rx={3}
                fill={step < 0 ? "var(--chart-track)" : color}
                fillOpacity={step < 0 ? 1 : OPACITY[step]}
              />
            ))}
            <text x={keyRight} y={keyY + CELL / 2} textAnchor="end" dominantBaseline="middle">
              More
            </text>
          </g>
        </svg>
      ) : null}

      {nonZero.length === 0 && width > 0 ? (
        <p
          className="pointer-events-none absolute inset-x-0 text-center text-xs text-muted-foreground"
          style={{ top: TOP + gridHeight / 2, transform: "translateY(-50%)" }}
        >
          {emptyText}
        </p>
      ) : null}

      {activeDay && active !== null && width > 0 ? (
        <div
          id={`${id}-tip`}
          role="tooltip"
          className="viz-tip"
          style={{
            left: Math.min(Math.max(cellX(active) + CELL / 2, 72), width - 72),
            top: Math.max(0, cellY(active) - 6),
            transform: "translate(-50%, -100%)",
          }}
        >
          <p className="mb-1 font-medium text-foreground">{format(asLocal(activeDay.day), "EEE d MMM")}</p>
          <p className="whitespace-nowrap font-semibold tabular-nums text-foreground">{formatValue(activeDay.value, unit)}</p>
          {activeDay.detail ? <p className="text-muted-foreground">{activeDay.detail}</p> : null}
        </div>
      ) : null}

      {/* The same figures as a table, for screen readers and anyone who prefers one. */}
      <div className="sr-only">
        <table>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">Value</th>
              <th scope="col">Detail</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.day}>
                <th scope="row">{format(asLocal(d.day), "EEE d MMM")}</th>
                <td>{formatValue(d.value, unit)}</td>
                <td>{d.detail ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
