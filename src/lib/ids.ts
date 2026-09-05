/**
 * Primary keys. Every id in this system is a UUID v7.
 *
 * v7 over v4 because v7 embeds a millisecond timestamp in its high bits, so
 * ids sort chronologically. That gives us B-tree index locality on insert
 * (rows land at the right edge of the index instead of scattering across it)
 * and a free "created order" without a secondary sort. At 500 registrations a
 * month growing, that locality is worth having from day one.
 *
 * Generated in the application, not the database: Postgres gained a native
 * uuidv7() only in version 18, and Railway provisions 16/17. Generating here
 * also means an id exists before the INSERT, which the audit log and the CSV
 * importer both rely on.
 */

import { v7 as uuidv7 } from "uuid"

/** A fresh UUID v7. The only id generator in the codebase. */
export function newId(): string {
  return uuidv7()
}

/** Shape check for ids arriving from a URL or form. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value)
}
