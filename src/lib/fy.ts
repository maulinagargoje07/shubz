/**
 * Dates and the Indian financial year.
 *
 * Two rules hold everywhere:
 *
 * 1. Timestamps are stored as timestamptz in UTC and displayed in
 *    Asia/Kolkata. Never store a naive datetime.
 * 2. "Today" for business purposes is today *in Pune*, not in UTC. A payment
 *    recorded at 02:00 IST on 6 September is a 6 September payment, though UTC
 *    still calls it the 5th. Anything deciding whether a fee is overdue must
 *    use these helpers, or SQL's `(now() AT TIME ZONE 'Asia/Kolkata')::date`.
 *
 * Timezone conversion uses the built-in Intl APIs rather than a date library
 * plugin: India is a fixed UTC+05:30 with no daylight saving, so there is no
 * DST edge case to outsource, and this keeps the dependency list to what was
 * agreed. date-fns is still used for all pattern formatting.
 */

import { format } from "date-fns"

export const IST = "Asia/Kolkata"

const IST_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: IST,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
})

/** "yyyy-MM-dd" for a given instant, in Pune local time. */
const IST_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: IST,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/**
 * Re-express an instant as a Date whose *local* fields carry the IST
 * wall-clock reading. Only for handing to date-fns `format`; never store one.
 */
function istWallClock(instant: Date): Date {
  const parts = IST_PARTS.formatToParts(instant)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0")

  // Intl renders midnight as hour 24 in some engines; normalise to 0.
  const hour = get("hour") % 24

  return new Date(
    get("year"),
    get("month") - 1,
    get("day"),
    hour,
    get("minute"),
    get("second")
  )
}

/** Today's calendar date in Pune as "yyyy-MM-dd", for `date` columns. */
export function todayIST(): string {
  return IST_DATE.format(new Date())
}

/** Any instant's calendar date in Pune as "yyyy-MM-dd". */
export function toISTDateString(instant: Date = new Date()): string {
  return IST_DATE.format(instant)
}

/**
 * The Indian financial year a date falls in, identified by its START year.
 * FY 2026-27 runs 1 Apr 2026 - 31 Mar 2027 and is returned as 2026.
 *
 * Receipt numbers use this, so a receipt issued in Feb 2027 reads
 * ST-2026-000842 and one financial year forms a contiguous block of receipt
 * numbers for the accountant.
 */
export function financialYear(date: Date | string = new Date()): number {
  // A bare "yyyy-MM-dd" is a calendar date already, with no timezone to resolve.
  const ymd =
    typeof date === "string" && /^\d{4}-\d{2}-\d{2}/.test(date)
      ? date.slice(0, 10)
      : toISTDateString(typeof date === "string" ? new Date(date) : date)

  const [year, month] = ymd.split("-").map(Number)
  return month >= 4 ? year : year - 1
}

/** "2026-27", for receipts and dashboard headings. */
export function financialYearLabel(date: Date | string = new Date()): string {
  const start = financialYear(date)
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`
}

/**
 * Inclusive start / exclusive end instants of a financial year.
 * 1 Apr 2026 00:00 IST is 31 Mar 2026 18:30 UTC.
 */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

export function financialYearRange(startYear: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(startYear, 3, 1) - IST_OFFSET_MS),
    end: new Date(Date.UTC(startYear + 1, 3, 1) - IST_OFFSET_MS),
  }
}

/** Start / end instants of a calendar month in IST. `month` is 1-indexed. */
export function monthRangeIST(year: number, month: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, month - 1, 1) - IST_OFFSET_MS),
    end: new Date(Date.UTC(year, month, 1) - IST_OFFSET_MS),
  }
}

/** Format a stored timestamptz for display in Pune local time. */
export function formatIST(
  value: Date | string | null | undefined,
  pattern = "d MMM yyyy, h:mm a"
): string {
  if (value == null) return "—"
  const d = typeof value === "string" ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return "—"
  return format(istWallClock(d), pattern)
}

/**
 * Format a date-only column. These carry no timezone, so they are parsed as
 * plain calendar dates — parsing "2026-09-05" through `new Date()` alone would
 * treat it as UTC midnight and render as the 4th west of Greenwich.
 */
export function formatDate(
  value: Date | string | null | undefined,
  pattern = "d MMM yyyy"
): string {
  if (value == null) return "—"
  const d =
    typeof value === "string"
      ? new Date(`${value.slice(0, 10)}T00:00:00`)
      : value
  if (Number.isNaN(d.getTime())) return "—"
  return format(d, pattern)
}

/** Whole days between two "yyyy-MM-dd" calendar dates. Positive if `to` is later. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from.slice(0, 10)}T00:00:00Z`)
  const b = Date.parse(`${to.slice(0, 10)}T00:00:00Z`)
  return Math.round((b - a) / 86_400_000)
}
