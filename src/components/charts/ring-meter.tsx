"use client"

import { cn } from "cn"

import { useMounted } from "./support"

/*
 * A ratio against a limit, as a ring: the fill is the accent, the unfilled
 * track a faint step of the same hue, and the figure sits in the middle. The
 * ring sweeps round when it first appears.
 */
export function RingMeter({
  ratio,
  size = 128,
  stroke = 11,
  color = "var(--chart-1)",
  children,
  label,
  className,
}: {
  /** 0 to 1. */
  ratio: number
  size?: number
  stroke?: number
  color?: string
  /** What goes in the middle: the figure and a word under it. */
  children: React.ReactNode
  /** Accessible name, e.g. "Renewal rate 22%". */
  label: string
  className?: string
}) {
  const mounted = useMounted()
  const clamped = Math.min(1, Math.max(0, ratio))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - (mounted ? clamped : 0))

  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--chart-track)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="viz-ring"
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  )
}
