/**
 * Building blocks shared by every form schema.
 *
 * These schemas are imported by BOTH the client form and the server action, so
 * validation cannot drift between what the browser accepts and what the
 * database is asked to store. The server re-parses regardless — client-side
 * validation is a convenience, never a guarantee.
 */

import { z } from "zod"

import { looksLikePhone } from "@/lib/phone-format"
import { toPaise } from "@/lib/money"

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

export const optionalEmail = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional()
  .refine(
    (v) => v === null || v === undefined || z.string().email().safeParse(v).success,
    "Not a valid email address"
  )
  .transform((v) => v ?? null)

export const optionalUrl = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional()
  .refine(
    (v) => v === null || v === undefined || /^https?:\/\/\S+$/i.test(v),
    "Must be a link starting with http:// or https://"
  )
  .transform((v) => v ?? null)

/**
 * A phone number as typed.
 *
 * This does NOT normalise to E.164 — it only checks the shape, using the
 * dependency-free validator so the shared schema stays out of libphonenumber's
 * 150 kB of metadata. Server actions run `parsePhone()` on the way to the
 * database, which is what actually guarantees one canonical string per human.
 */
export const phoneSchema = z
  .string()
  .trim()
  .min(1, "Phone number is required")
  .refine(looksLikePhone, "Not a valid phone number")

export const optionalPhoneSchema = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional()
  .refine(
    (v) => v === null || v === undefined || looksLikePhone(v),
    "Not a valid phone number"
  )
  .transform((v) => v ?? null)

/**
 * A rupee amount typed by a human, stored as integer paise.
 * Accepts "45,000", "₹45,000", "45000.50".
 */
export const rupeesSchema = z
  .union([z.string(), z.number()])
  .transform((v, ctx) => {
    try {
      return toPaise(v)
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : "Not a valid amount",
      })
      return z.NEVER
    }
  })

export const optionalRupeesSchema = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v, ctx) => {
    if (v === undefined || v === "") return 0
    try {
      return toPaise(v)
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : "Not a valid amount",
      })
      return z.NEVER
    }
  })

/** A "yyyy-MM-dd" calendar date from a date input. */
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")

export const optionalDateSchema = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional()
  .refine(
    (v) => v === null || v === undefined || /^\d{4}-\d{2}-\d{2}$/.test(v),
    "Pick a valid date"
  )
  .transform((v) => v ?? null)

export const optionalPositiveInt = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v, ctx) => {
    if (v === undefined || v === "" || v === null) return null
    const n = typeof v === "number" ? v : Number(v)
    if (!Number.isInteger(n) || n < 0) {
      ctx.addIssue({ code: "custom", message: "Must be a whole number" })
      return z.NEVER
    }
    return n
  })

/** The shape every server action returns, so forms can handle results uniformly. */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }
