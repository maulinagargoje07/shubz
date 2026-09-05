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
  phone: ["phone", "mobile", "number", "contact number", "whatsapp", "phone number"],
  altPhone: ["alt phone", "alternate", "alternate phone", "phone 2", "secondary"],
  email: ["email", "e-mail", "mail", "email address"],
  city: ["city", "town", "location"],
  state: ["state", "province", "region"],
  telegramUsername: ["telegram", "telegram username", "tg"],
  tradingviewUsername: ["tradingview", "tradingview username", "tv"],
  notes: ["notes", "remark", "remarks", "comment", "comments"],
}

export function guessColumnMap(headers: string[]): Partial<Record<ImportableField, string>> {
  const map: Partial<Record<ImportableField, string>> = {}
  const used = new Set<string>()

  for (const [field, hints] of Object.entries(HEADER_HINTS) as [
    ImportableField,
    string[],
  ][]) {
    const match = headers.find((h) => {
      if (used.has(h)) return false
      const normalised = h.toLowerCase().replace(/[_-]+/g, " ").trim()
      return hints.includes(normalised)
    })
    if (match) {
      map[field] = match
      used.add(match)
    }
  }

  return map
}
