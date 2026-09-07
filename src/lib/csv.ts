/**
 * CSV parsing and column mapping for the contact importer.
 *
 * The source data is Excel exports, so the parser has to cope with a UTF-8
 * BOM, CRLF line endings, quoted fields containing commas, and header rows
 * with inconsistent casing and spacing. papaparse handles the grammar; this
 * module handles the ShubzTrader-specific mapping and validation.
 */

import Papa from "papaparse"

/** Contact fields an imported column can be mapped onto. */
export const IMPORTABLE_FIELDS = [
  { key: "fullName", label: "Full name", required: true },
  { key: "phone", label: "Phone", required: true },
  { key: "altPhone", label: "Alternate phone", required: false },
  { key: "email", label: "Email", required: false },
  { key: "city", label: "City", required: false },
  { key: "state", label: "State", required: false },
  { key: "telegramUsername", label: "Telegram", required: false },
  { key: "tradingviewUsername", label: "TradingView", required: false },
  { key: "tradingExperience", label: "Trading experience", required: false },
  { key: "capturedAt", label: "Captured at (form timestamp)", required: false },
  { key: "notes", label: "Notes", required: false },
] as const

export type ImportableField = (typeof IMPORTABLE_FIELDS)[number]["key"]

export type ParsedCsv = {
  headers: string[]
  rows: Record<string, string>[]
}

export function parseCsv(text: string): ParsedCsv {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    // Excel exports frequently carry a BOM and pad headers with spaces.
    transformHeader: (h) => h.replace(/^﻿/, "").trim(),
    transform: (v) => (typeof v === "string" ? v.trim() : v),
  })

  return {
    headers: result.meta.fields ?? [],
    rows: result.data.filter((row) =>
      Object.values(row).some((v) => v != null && String(v).trim() !== "")
    ),
  }
}

/**
 * Guess which CSV column feeds which contact field, so the mapping step starts
 * mostly filled in rather than entirely blank.
 */
const HEADER_HINTS: Record<ImportableField, string[]> = {
  fullName: ["name", "full name", "fullname", "student", "student name", "contact"],
  phone: [
    "phone",
    "mobile",
    "number",
    "contact number",
    "whatsapp",
    "phone number",
    // Google Form headers arrive with punctuation and a channel in brackets.
    "contact no whatsapp",
    "contact no",
    "whatsapp number",
    "whatsapp no",
    "mobile number",
  ],
  altPhone: ["alt phone", "alternate", "alternate phone", "phone 2", "secondary"],
  email: ["email", "e-mail", "mail", "email address"],
  city: ["city", "town", "location"],
  state: ["state", "province", "region"],
  telegramUsername: ["telegram", "telegram username", "tg"],
  tradingviewUsername: ["tradingview", "tradingview username", "tv"],
  tradingExperience: [
    "trading experience",
    "experience",
    "trading exp",
    "how long have you been trading",
    "your trading experience",
  ],
  capturedAt: ["timestamp", "submitted at", "date", "submission time", "created at"],
  notes: ["notes", "remark", "remarks", "comment", "comments"],
}

/**
 * Headers as typed by a human, reduced to comparable words.
 *
 * Real headers are "Contact no. (Whatsapp)" and "Mail", not "phone". Stripping
 * punctuation and collapsing spaces lets one hint match several spellings
 * without needing an entry for every variation the form might use.
 */
function normaliseHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

export function guessColumnMap(headers: string[]): Partial<Record<ImportableField, string>> {
  const map: Partial<Record<ImportableField, string>> = {}
  const used = new Set<string>()

  for (const [field, hints] of Object.entries(HEADER_HINTS) as [
    ImportableField,
    string[],
  ][]) {
    // Exact match first so a precise header always wins over a loose one:
    // "Name" must take fullName before "Contact no. (Whatsapp)" can claim it
    // by containing the word "contact".
    let match = headers.find(
      (h) => !used.has(h) && hints.includes(normaliseHeader(h))
    )

    if (!match) {
      match = headers.find((h) => {
        if (used.has(h)) return false
        const normalised = normaliseHeader(h)
        return hints.some(
          (hint) => normalised === hint || normalised.includes(hint)
        )
      })
    }
    if (match) {
      map[field] = match
      used.add(match)
    }
  }

  return map
}

/**
 * Parse a spreadsheet timestamp into an instant.
 *
 * Google Forms writes the sheet's own locale, so "9/7/2026 17:36:21" is
 * genuinely ambiguous on its face — 9 July or 7 September. Two things resolve
 * it: if either number exceeds 12 it can only be the day, and failing that the
 * month-first reading is used, which is what Google Sheets produces by default
 * and what the sheets this was built against contain.
 *
 * Because the fallback is a guess, the importer shows the parsed date back in
 * the preview: a whole column landing on the wrong date is obvious there,
 * before anything is written.
 *
 * Times carry no zone, so they are read as IST — the only timezone this
 * business operates in, and the one whoever filled the form was standing in.
 */
export function parseSheetTimestamp(value: string): Date | null {
  const text = value?.trim()
  if (!text) return null

  // ISO first: unambiguous, and what a re-export or an API dump produces.
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(text)
  if (iso) {
    const [, y, mo, d, h = "0", mi = "0", sec = "0"] = iso
    return istInstant(+y, +mo, +d, +h, +mi, +sec)
  }

  const slash =
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?)?/i.exec(
      text
    )
  if (!slash) return null

  const [, aRaw, bRaw, yRaw, hRaw = "0", miRaw = "0", secRaw = "0", meridiem] = slash
  const a = +aRaw
  const b = +bRaw

  let month: number
  let day: number
  if (a > 12 && b <= 12) {
    day = a
    month = b
  } else if (b > 12 && a <= 12) {
    month = a
    day = b
  } else {
    // Ambiguous: month-first, as Google Sheets writes by default.
    month = a
    day = b
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  let hour = +hRaw
  if (meridiem) {
    const pm = meridiem.toLowerCase() === "pm"
    if (hour === 12) hour = pm ? 12 : 0
    else if (pm) hour += 12
  }

  return istInstant(+yRaw, month, day, hour, +miRaw, +secRaw)
}

/** Build a UTC instant from an IST wall-clock reading. */
function istInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number
): Date | null {
  const stamp = Date.UTC(year, month - 1, day, hour, minute, second) - 5.5 * 60 * 60 * 1000
  const date = new Date(stamp)
  if (Number.isNaN(date.getTime())) return null
  // Reject a rolled-over date (31 February and friends) rather than storing it.
  const check = new Date(stamp + 5.5 * 60 * 60 * 1000)
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null
  return date
}
