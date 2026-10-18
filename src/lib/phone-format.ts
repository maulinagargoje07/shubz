/**
 * Showing phone numbers. Dependency-free, so it is safe in client components.
 *
 * Buyers' numbers arrive from the payments service already normalised to
 * E.164 ("+919876543210") — the checkout page built them from a country code
 * picker plus the local number, and the payments service validated them. All
 * that is left here is making them readable and clickable.
 */

/**
 * The country codes the checkout page offers, longest first so "+971" is
 * matched before anything shorter. None of them is a prefix of another.
 */
const COUNTRY_CODES = [
  "971", "966", "974", "965", "968", "973", "977", "880", "353", "254", "234",
  "91", "44", "61", "64", "65", "60", "94", "49", "33", "31", "27",
  "1",
]

export function phoneDigits(input: string): string {
  return input.replace(/\D/g, "")
}

/**
 * "+919876543210" -> "+91 98765 43210"; "+971501234567" -> "+971 501234567".
 * Anything unrecognised comes back as it was.
 */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "—"
  const match = /^\+(\d{7,15})$/.exec(e164.trim())
  if (!match) return e164
  const digits = match[1]

  if (digits.startsWith("91") && digits.length === 12) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`
  }
  const code = COUNTRY_CODES.find((c) => digits.startsWith(c))
  return code ? `+${code} ${digits.slice(code.length)}` : e164
}

/** A wa.me link, which opens a chat in WhatsApp on phone or desktop. */
export function whatsappHref(e164: string): string {
  return `https://wa.me/${phoneDigits(e164)}`
}
