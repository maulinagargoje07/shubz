/**
 * Phone numbers. The contact table's identity column.
 *
 * `phone_e164` is UNIQUE among live contacts and is what dedupe, WhatsApp and
 * every lookup key off. It must therefore be canonical: exactly one string for
 * one human. "9876543210", "+91 98765 43210", "098765-43210" and
 * "+919876543210" are the same person and must all normalise to
 * "+919876543210".
 *
 * Every write path — the contact form, a server action, the CSV importer —
 * runs parsePhone() before touching the database. There is no other way in.
 */

import {
  parsePhoneNumberWithError,
  isValidPhoneNumber,
  type CountryCode,
} from "libphonenumber-js"

/** ShubzTrader is a Pune business; bare 10-digit numbers are Indian. */
export const DEFAULT_REGION: CountryCode = "IN"

export type ParsedPhone = {
  /** Canonical form for the phone_e164 column, e.g. "+919876543210". */
  e164: string
  /** Exactly what the human typed, for the phone_raw column. */
  raw: string
  /** Pretty form for display, e.g. "+91 98765 43210". */
  formatted: string
  country: CountryCode | undefined
}

export class PhoneError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PhoneError"
  }
}

/**
 * Normalise a phone number to E.164, or throw PhoneError with a message fit to
 * show a user in a form field.
 */
export function parsePhone(
  input: string,
  region: CountryCode = DEFAULT_REGION
): ParsedPhone {
  const raw = input.trim()

  if (raw === "") {
    throw new PhoneError("Phone number is required")
  }

  let parsed
  try {
    parsed = parsePhoneNumberWithError(raw, region)
  } catch {
    throw new PhoneError(`"${raw}" is not a recognisable phone number`)
  }

  if (!parsed.isValid()) {
    throw new PhoneError(`"${raw}" is not a valid phone number`)
  }

  return {
    e164: parsed.number,
    raw,
    formatted: parsed.formatInternational(),
    country: parsed.country,
  }
}

/**
 * Non-throwing variant. Returns null instead of raising — for the CSV importer,
 * which must classify a whole file of rows rather than abort on the first bad one.
 */
export function tryParsePhone(
  input: string | null | undefined,
  region: CountryCode = DEFAULT_REGION
): ParsedPhone | null {
  if (input == null) return null
  try {
    return parsePhone(input, region)
  } catch {
    return null
  }
}

/** Cheap predicate for zod refinements. */
export function isValidPhone(
  input: string,
  region: CountryCode = DEFAULT_REGION
): boolean {
  if (!input?.trim()) return false
  try {
    return isValidPhoneNumber(input.trim(), region)
  } catch {
    return false
  }
}

/**
 * Format a stored E.164 number for display. Falls back to the stored value if
 * it somehow will not parse, so a bad legacy row still renders something.
 */
export function formatPhone(e164: string): string {
  try {
    return parsePhoneNumberWithError(e164).formatInternational()
  } catch {
    return e164
  }
}
