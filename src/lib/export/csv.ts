/**
 * CSV for the downloads, built to survive a round trip through Excel and
 * Google Sheets: a BOM so UTF-8 names decode, CRLF line endings, and quoting
 * for commas, quotes and line breaks.
 *
 * Buyers type their own names, emails and TradingView usernames, so a value
 * starting with = + - or @ could run as a formula when the file is opened.
 * Those values get a leading apostrophe, which spreadsheets treat as "this is
 * text". Phone numbers ("+919876543210") are left alone: the payments service
 * only stores digits after the plus, which can never be a formula.
 */

export type CsvValue = string | number | null | undefined

const FORMULA_START = /^[=+\-@\t\r]/
const E164 = /^\+\d{6,15}$/

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return ""
  let text = String(value)
  if (typeof value === "string" && FORMULA_START.test(text) && !E164.test(text)) {
    text = `'${text}`
  }
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`
  return text
}

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers.map(csvCell).join(",")]
  for (const row of rows) lines.push(row.map(csvCell).join(","))
  return `﻿${lines.join("\r\n")}\r\n`
}
