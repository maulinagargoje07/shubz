/**
 * Reading filter values out of the URL.
 *
 * Every list page used to define its own one-line `str()` helper that returned
 * any non-empty string, and pass the result straight into a query that compares
 * it against a `uuid` column. Postgres rejects a malformed uuid outright, so a
 * URL like `?batch=all` — a stale bookmark, a hand-edited address, a crawler —
 * did not filter to nothing, it threw `invalid input syntax for type uuid` and
 * took the whole content area of the page down with it.
 *
 * A filter that cannot be satisfied should show an unfiltered list, never an
 * error. These helpers make that the default: anything that is not a plausible
 * id is treated as "no filter given".
 */

export type RawParam = string | string[] | undefined

/** A trimmed, non-empty string, or undefined. Arrays take their first entry. */
export function textParam(value: RawParam): string | undefined {
  const first = Array.isArray(value) ? value[0] : value
  if (typeof first !== "string") return undefined
  const trimmed = first.trim()
  return trimmed === "" ? undefined : trimmed
}

/** Canonical 8-4-4-4-12 hex form. Version and variant are not checked — the
 *  ids here are uuid v7 and rejecting on version would be a trap later. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * An id filter: a uuid, or one of the sentinels the caller explicitly allows.
 *
 * `allow` exists for values that are a real answer rather than an id — the
 * enrollment list's "none", meaning "students with no batch at all".
 */
export function idParam(
  value: RawParam,
  allow: readonly string[] = []
): string | undefined {
  const text = textParam(value)
  if (text === undefined) return undefined
  if (allow.includes(text)) return text
  return UUID_RE.test(text) ? text : undefined
}

/** A positive page number, defaulting to 1. Junk and 0 and -3 all mean page 1. */
export function pageParam(value: RawParam): number {
  const parsed = Number(textParam(value))
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1
}

/**
 * A value constrained to a known set — status, stage, source and the like.
 *
 * These are not uuids so they do not crash the query, but an unknown value
 * still filters the list down to nothing with no way to tell why, so it is
 * better read as no filter at all.
 */
export function enumParam<T extends string>(
  value: RawParam,
  allowed: readonly T[]
): T | undefined {
  const text = textParam(value)
  return text !== undefined && (allowed as readonly string[]).includes(text)
    ? (text as T)
    : undefined
}
