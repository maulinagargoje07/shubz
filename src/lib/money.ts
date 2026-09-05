/**
 * Money. Read this before touching any amount in the codebase.
 *
 * Every monetary value is stored and computed as an integer number of PAISE
 * (1 rupee = 100 paise) in a BIGINT column. Never float, never decimal, never
 * rupees. Rupees exist only as (a) text a human typed into a form and (b) text
 * rendered onto a screen or receipt. Both boundaries are crossed here and
 * nowhere else.
 *
 * Why: floating point cannot represent 0.1 exactly, so rupee arithmetic drifts.
 * A ₹45,000 fee split into 3 installments must sum back to exactly ₹45,000.
 * Integer paise make that trivially true.
 *
 * Range: JS numbers are exact integers up to 2^53-1, which is ~₹90,07,19,92,54,740.
 * ShubzTrader's largest conceivable figure is many orders of magnitude below
 * that, so `bigint({ mode: 'number' })` in Drizzle is safe and keeps arithmetic
 * ordinary. See assertSafePaise() for the guard.
 */

/** Largest paise value that survives JS integer arithmetic exactly. */
const MAX_SAFE_PAISE = Number.MAX_SAFE_INTEGER

export class MoneyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "MoneyError"
  }
}

/**
 * Throws if a paise value is not an exact, finite, non-negative integer.
 * Call this at the edge of any computation that could produce a fraction.
 */
export function assertSafePaise(paise: number, label = "amount"): number {
  if (!Number.isFinite(paise)) {
    throw new MoneyError(`${label} is not a finite number: ${paise}`)
  }
  if (!Number.isInteger(paise)) {
    throw new MoneyError(
      `${label} must be a whole number of paise, got ${paise}. ` +
        `Fractional paise cannot exist — round before storing.`
    )
  }
  if (paise < 0) {
    throw new MoneyError(`${label} must not be negative, got ${paise}`)
  }
  if (paise > MAX_SAFE_PAISE) {
    throw new MoneyError(`${label} exceeds safe integer range: ${paise}`)
  }
  return paise
}

/**
 * Parse a rupee amount as typed by a human into integer paise.
 *
 * Accepts: 45000 | "45000" | "45,000" | "₹45,000" | "45000.50" | " 45,000.5 "
 * Rejects: anything with more than 2 decimal places, negatives, non-numerics.
 *
 * Rounding: exactly 2 decimal places are permitted and converted precisely.
 * We parse the decimal string digit-wise rather than multiplying by 100,
 * because `45000.55 * 100` is 4500054.999999999 in IEEE 754.
 */
export function toPaise(input: string | number): number {
  if (typeof input === "number") {
    if (!Number.isFinite(input)) {
      throw new MoneyError(`Amount is not a finite number: ${input}`)
    }
    // Route numbers through the string path so the digit-wise parse applies.
    input = input.toString()
  }

  const cleaned = input.trim().replace(/[₹,\s]/g, "")

  if (cleaned === "") {
    throw new MoneyError("Amount is empty")
  }

  const match = /^(-)?(\d*)(?:\.(\d{1,2}))?$/.exec(cleaned)
  if (!match) {
    throw new MoneyError(
      `"${input}" is not a valid rupee amount. Use digits with at most 2 decimal places.`
    )
  }

  const [, negative, whole, decimals] = match

  if (negative) {
    throw new MoneyError(`Amount must not be negative: "${input}"`)
  }
  if (whole === "" && decimals === undefined) {
    throw new MoneyError(`"${input}" is not a valid rupee amount`)
  }

  const rupees = whole === "" ? 0 : Number(whole)
  // "5" means 50 paise, "05" means 5 paise. Pad right to exactly 2 digits.
  const paiseFraction = decimals ? Number(decimals.padEnd(2, "0")) : 0

  const total = rupees * 100 + paiseFraction
  return assertSafePaise(total, `Amount "${input}"`)
}

/** Integer paise -> a plain rupee number. For form default values only. */
export function toRupees(paise: number): number {
  assertSafePaise(paise)
  return paise / 100
}

/**
 * Render paise as Indian currency for display. THE ONLY WAY money reaches a
 * screen. Uses the en-IN locale so grouping is lakh/crore style:
 * 4500000 paise -> "₹45,000.00", 12345678900 paise -> "₹12,34,56,789.00"
 */
export function formatINR(
  paise: number,
  options: { paise?: boolean; compact?: boolean } = {}
): string {
  const { paise: showPaise = true, compact = false } = options
  assertSafePaise(paise)

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: showPaise ? 2 : 0,
    maximumFractionDigits: showPaise ? 2 : 0,
    notation: compact ? "compact" : "standard",
  }).format(paise / 100)
}

/** Whole-rupee variant for dashboard tiles, where paise are noise. */
export function formatINRShort(paise: number): string {
  return formatINR(paise, { paise: false })
}

/**
 * Split a total into `count` installments that sum back to EXACTLY the total.
 *
 * Integer division leaves a remainder; we push it onto the FIRST installment
 * rather than the last, so the customer's opening payment absorbs the odd
 * paise and every later installment is a clean, predictable figure.
 *
 * splitInstallments(4000000, 3) -> [1333334, 1333333, 1333333]  (sums to 4000000)
 */
export function splitInstallments(totalPaise: number, count: number): number[] {
  assertSafePaise(totalPaise, "Installment total")
  if (!Number.isInteger(count) || count < 1) {
    throw new MoneyError(`Installment count must be a positive integer, got ${count}`)
  }
  if (count > 120) {
    throw new MoneyError(`Installment count ${count} is unreasonably large`)
  }

  const base = Math.floor(totalPaise / count)
  const remainder = totalPaise - base * count

  const parts = Array.from({ length: count }, () => base)
  parts[0] += remainder

  return parts
}
