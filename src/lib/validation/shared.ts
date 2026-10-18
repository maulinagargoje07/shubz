/**
 * Building blocks shared by every form schema.
 *
 * These schemas are imported by BOTH the client form and the server action, so
 * validation cannot drift between what the browser accepts and what the
 * server is asked to store. The server re-parses regardless — client-side
 * validation is a convenience, never a guarantee.
 */

import { z } from "zod"

/** A UUID from a URL, a select, or a hidden field. */
export const uuidSchema = z.string().uuid("Not a valid id")

/** Optional text that arrives as "" from an empty input and should be null. */
export const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional()
  .transform((v) => v ?? null)

/** The shape every server action returns, so forms can handle results uniformly. */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }
