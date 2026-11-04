import { formatINR } from "@/lib/money"

/**
 * What the charts share: the colour slots and how a value is written. Pure,
 * so server components can use the slots too (the hooks live in support.ts).
 *
 * Colours are CSS variables from globals.css, so the same chart recolours
 * itself for the light theme. The slots are fixed by meaning — gold is money
 * and the 3-month plan, blue is a first purchase, teal is a renewal and UPI —
 * so a colour never means one thing on one chart and another thing on the next.
 */
export const SERIES = {
  gold: "var(--chart-1)",
  blue: "var(--chart-2)",
  teal: "var(--chart-3)",
  violet: "var(--chart-4)",
  rose: "var(--chart-5)",
  neutral: "var(--chart-neutral)",
} as const

/** The sheet's colour key, for status parts. */
export const STATUS = {
  active: "var(--paid)",
  expiring: "var(--pending)",
  expired: "var(--overdue)",
  check: "var(--chart-1)",
} as const

/** How a chart writes a value: rupees, a count, or a share. */
export type Unit = "inr" | "count" | "percent"

/** The full figure, for tooltips and legends: ₹25,694 · 12 · 22.2% */
export function formatValue(value: number, unit: Unit): string {
  if (unit === "inr") return formatINR(Math.round(value), { paise: false })
  if (unit === "percent") return `${(value * 100).toFixed(1)}%`
  return value.toLocaleString("en-IN")
}

/** The short figure, for axis ticks and cap labels: ₹25K · 12 · 22% */
export function formatShort(value: number, unit: Unit): string {
  if (unit === "percent") return `${Math.round(value * 100)}%`
  if (unit === "inr") {
    const rupees = value / 100
    if (rupees >= 10_000_000) return `₹${trim(rupees / 10_000_000)}Cr`
    if (rupees >= 100_000) return `₹${trim(rupees / 100_000)}L`
    if (rupees >= 1_000) return `₹${trim(rupees / 1_000)}K`
    return `₹${Math.round(rupees)}`
  }
  return value.toLocaleString("en-IN")
}

const trim = (n: number) => (n >= 100 ? Math.round(n).toString() : n.toFixed(1).replace(/\.0$/, ""))

/**
 * A round axis: a step of 1, 2, 2.5 or 5 × 10ⁿ and a tick count of 3 to 5,
 * chosen so the top gridline sits as close above `max` as a round number
 * allows (a ₹22.7K peak gets ₹5K steps up to ₹25K, not ₹10K steps to ₹40K).
 */
export function niceScale(max: number, unit: Unit): { step: number; ticks: number } {
  // Counts get whole-number steps; rupees are in paise, so any step is whole.
  const integer = unit === "count"
  if (max <= 0) return { step: 1, ticks: 4 }
  let best = { step: max, ticks: 1, top: Infinity }
  const magnitude = Math.pow(10, Math.floor(Math.log10(max)) - 1)
  for (const ticks of integer ? [2, 3, 4, 5] : [3, 4, 5]) {
    for (const factor of [1, 2, 2.5, 5, 10, 20, 25, 50, 100]) {
      const step = magnitude * factor
      if (integer && !Number.isInteger(step)) continue
      const top = step * ticks
      if (top >= max && top < best.top) best = { step, ticks, top }
    }
  }
  return { step: best.step, ticks: best.ticks }
}

