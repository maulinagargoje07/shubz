/**
 * Generating a run of class dates.
 *
 * Batches meet on a repeating pattern — "Mon/Wed/Fri at 7:30 for twelve
 * weeks" — but sessions could only be added one at a time, eight fields each,
 * from four levels down the navigation. Twelve classes meant twelve trips
 * through that dialog, and the sequence numbers had to be kept straight by
 * hand.
 *
 * This is the pure part: given a start, a set of weekdays and a count, produce
 * the dates. No database, no timezone objects — it works in plain
 * "yyyy-MM-dd" calendar dates, which is what a human means by "starting
 * Monday the 6th". The action turns each into an instant at IST.
 */

/** 0 = Sunday … 6 = Saturday, matching `Date.getUTCDay()`. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export const WEEKDAY_LABELS: { value: Weekday; short: string; long: string }[] = [
  { value: 1, short: "Mon", long: "Monday" },
  { value: 2, short: "Tue", long: "Tuesday" },
  { value: 3, short: "Wed", long: "Wednesday" },
  { value: 4, short: "Thu", long: "Thursday" },
  { value: 5, short: "Fri", long: "Friday" },
  { value: 6, short: "Sat", long: "Saturday" },
  { value: 0, short: "Sun", long: "Sunday" },
]

/** Hard ceiling, so a typo in "count" cannot insert thousands of rows. */
export const MAX_SESSIONS_PER_SERIES = 60

export function weekdayOf(dateISO: string): Weekday {
  return new Date(`${dateISO}T00:00:00Z`).getUTCDay() as Weekday
}

function addDays(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export type SeriesInput = {
  /** "yyyy-MM-dd". The first candidate date; included if it matches a weekday. */
  startDate: string
  /** Which days the class meets. Empty means "the start date's own weekday". */
  weekdays: Weekday[]
  /** How many sessions to create. */
  count: number
  /** Optional hard stop; the run ends here even if `count` is not reached. */
  endDate?: string | null
}

/**
 * The calendar dates for a series, in order.
 *
 * Walks forward day by day rather than doing week arithmetic: it keeps the
 * "which weekdays" logic trivially correct across month and year boundaries,
 * and the walk is bounded so a pattern that can never match cannot spin.
 */
export function generateSeriesDates(input: SeriesInput): string[] {
  const { startDate, count, endDate } = input

  const weekdays = input.weekdays.length
    ? [...new Set(input.weekdays)]
    : [weekdayOf(startDate)]

  const wanted = Math.min(Math.max(count, 1), MAX_SESSIONS_PER_SERIES)
  const dates: string[] = []

  // A week has seven days, so the longest gap between matches is seven; the
  // bound is generous but finite.
  const maxWalk = wanted * 7 + 14
  let cursor = startDate

  for (let step = 0; step < maxWalk && dates.length < wanted; step++) {
    if (endDate && cursor > endDate) break
    if (weekdays.includes(weekdayOf(cursor))) dates.push(cursor)
    cursor = addDays(cursor, 1)
  }

  return dates
}

/**
 * Fill a title template.
 *
 * `{n}` becomes the session's number within the batch, so "Week {n}" yields
 * "Week 1", "Week 2"… A template with no placeholder is used verbatim, which
 * is the right behaviour for a run of identically-named classes.
 */
export function renderTitle(template: string, seq: number): string {
  const filled = template.replace(/\{n\}/gi, String(seq))
  return filled.trim() || `Session ${seq}`
}

/** A preview line for the form: "Mon 6 Oct", so the user sees what they get. */
export function formatPreviewDate(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00Z`)
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })
}
