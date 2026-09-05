/**
 * Cheap, dependency-free phone checks safe to run in the browser.
 *
 * The authoritative parse lives in lib/phone.ts and uses libphonenumber-js,
 * which carries ~150 kB of country metadata. Importing that into the shared
 * zod schemas dragged it into every form bundle in the app — a large download
 * to tell someone their phone number is too short.
 *
 * So the split follows the rule the rest of the app already uses: client-side
 * validation is a convenience, the server is the authority. This module
 * rejects obvious nonsense instantly and in a few bytes; the server action
 * then runs the real parse, normalises to E.164, and returns a field error if
 * libphonenumber disagrees. Nothing reaches the database without that parse.
 */

/** E.164 permits 4–15 digits; anything outside that cannot be a phone number. */
const MIN_DIGITS = 7
const MAX_DIGITS = 15

export function phoneDigits(input: string): string {
  return input.replace(/\D/g, "")
}

/**
 * Is this plausibly a phone number? Deliberately permissive about country —
 * a Pune business still stores the occasional overseas number, and deciding
 * that is the server's job.
 */
export function looksLikePhone(input: string): boolean {
  const trimmed = input.trim()
  if (trimmed === "") return false

  // Reject letters outright; everything else is punctuation we can ignore.
  if (/[A-Za-z]/.test(trimmed)) return false

  const digits = phoneDigits(trimmed)
  if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) return false

  // A bare 10-digit Indian mobile must start 6–9. Catches transposed or
  // truncated numbers at the point of typing rather than after a round-trip.
  if (digits.length === 10 && !/^[6-9]/.test(digits)) return false

  return true
}

/** Format an already-normalised E.164 for display, without the metadata tables. */
export function formatE164(e164: string): string {
  const match = /^\+91(\d{5})(\d{5})$/.exec(e164)
  if (match) return `+91 ${match[1]} ${match[2]}`
  return e164
}
