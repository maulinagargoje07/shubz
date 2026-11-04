"use client"

import { useId } from "react"
import { cn } from "cn"

import { useWidth } from "./support"

/*
 * A sparkline for a stat tile: the last few weeks as a 2px line with a faint
 * wash under it and a dot on today. No axes, no labels — the tile's figure is
 * the number; this only shows which way it has been going.
 */
export function Sparkline({
  values,
  color = "var(--chart-1)",
  height = 40,
  className,
}: {
  values: number[]
  color?: string
  height?: number
  className?: string
}) {
  const { ref, width } = useWidth<HTMLDivElement>()
  const id = useId()
  const max = Math.max(0, ...values)
  const n = values.length
  const pad = 5

  const x = (i: number) => (n > 1 ? pad + (i / (n - 1)) * (width - pad * 2) : width / 2)
  const y = (v: number) => (max > 0 ? height - pad - (v / max) * (height - pad * 2) : height - pad)

  const line = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")
  const area = n > 0 ? `${line} L${x(n - 1).toFixed(1)},${height} L${x(0).toFixed(1)},${height} Z` : ""
  const last = n > 0 ? { x: x(n - 1), y: y(values[n - 1]) } : null

  return (
    <div ref={ref} className={cn("relative w-full", className)} style={{ height }} aria-hidden>
      {width > 0 && n > 1 ? (
        <svg width={width} height={height} className="block overflow-visible">
          <defs>
            <linearGradient id={`${id}-wash`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${id}-wash)`} className="viz-fade" />
          <path
            d={line}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            pathLength={1}
            className="viz-draw"
          />
          {last ? (
            <circle cx={last.x} cy={last.y} r={4} fill={color} stroke="var(--card)" strokeWidth={2} className="viz-fade" />
          ) : null}
        </svg>
      ) : null}
    </div>
  )
}
