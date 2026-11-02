import { z } from "zod"

import { DISCOUNT_TYPES, PAYMENT_METHODS } from "@/lib/indicator"
import { optionalText } from "./shared"

/**
 * The coupon and Razorpay-offer forms. Shared by the dialogs and the server
 * actions, so what the browser accepts is what the payments service is sent.
 *
 * Discounts are typed in rupees and percentages (people think in those); the
 * payments service stores paise and whole percentages.
 */

export const PLAN_OPTIONS = [
  { key: "1m", label: "1-month plan" },
  { key: "3m", label: "3-month plan" },
] as const

export const couponCodeSchema = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .pipe(
    z
      .string()
      .min(2, "At least 2 characters")
      .max(30, "At most 30 characters")
      .regex(/^[A-Z0-9][A-Z0-9_-]*$/, "Letters, numbers, - and _ only")
  )

/** One plan's discount as typed: "none", or a type and a number. */
const discountFieldSchema = z
  .object({
    type: z.enum(["none", ...DISCOUNT_TYPES]),
    value: z.union([z.string(), z.number()]).transform((v) => (typeof v === "number" ? String(v) : v.trim())),
  })
  .superRefine((d, ctx) => {
    if (d.type === "none") return
    const n = Number(d.value)
    if (d.value === "" || !Number.isFinite(n) || n <= 0) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "Enter the discount" })
      return
    }
    if (d.type === "percent" && (n > 100 || !Number.isInteger(n))) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "A whole number from 1 to 100" })
    }
    if (d.type === "flat" && Math.round(n * 100) !== n * 100) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "Rupees, up to 2 decimals" })
    }
  })
  .transform((d) => {
    if (d.type === "none") return null
    const n = Number(d.value)
    return { type: d.type, value: d.type === "percent" ? n : Math.round(n * 100) }
  })

/** A date typed in a date input (yyyy-MM-dd) or left blank. */
const dateFieldSchema = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Not a date")
  .transform((v) => (v === "" ? null : v))

const maxUsesSchema = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "number" ? String(v) : v.trim()))
  .refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) > 0), "A whole number, or blank for no limit")
  .transform((v) => (v === "" ? null : Number(v)))

export const couponFormSchema = z
  .object({
    code: couponCodeSchema,
    label: optionalText,
    discounts: z.object({ "1m": discountFieldSchema, "3m": discountFieldSchema }),
    startsAt: dateFieldSchema,
    endsAt: dateFieldSchema,
    maxUses: maxUsesSchema,
    onePerBuyer: z.boolean(),
    active: z.boolean(),
  })
  .superRefine((c, ctx) => {
    if (!c.discounts["1m"] && !c.discounts["3m"]) {
      ctx.addIssue({ code: "custom", path: ["discounts", "1m", "value"], message: "Give a discount on at least one plan" })
    }
    if (c.startsAt && c.endsAt && c.endsAt < c.startsAt) {
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "Ends before it starts" })
    }
  })

export type CouponFormValues = z.input<typeof couponFormSchema>
export type CouponFormParsed = z.output<typeof couponFormSchema>

export const updateCouponSchema = z.object({
  id: z.number().int().positive(),
  values: couponFormSchema,
})

export const couponIdSchema = z.object({ id: z.number().int().positive() })
export const setCouponActiveSchema = z.object({ id: z.number().int().positive(), active: z.boolean() })
/** An offer's codes, switched together. */
export const setOfferActiveSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(50),
  active: z.boolean(),
})

export const offerFormSchema = z.object({
  offerId: z
    .string()
    .trim()
    .regex(/^offer_[A-Za-z0-9]{8,}$/, "A Razorpay offer ID looks like offer_XXXXXXXXXXXXXX"),
  planKey: z.enum(["1m", "3m"]),
  method: z.enum(PAYMENT_METHODS),
  discount: discountFieldSchema.refine((d) => d !== null, { message: "Choose the discount this offer gives" }),
  label: optionalText,
})

export type OfferFormValues = z.input<typeof offerFormSchema>
export type OfferFormParsed = z.output<typeof offerFormSchema>

export const offerIdSchema = z.object({
  offerId: z.string().regex(/^offer_[A-Za-z0-9]+$/, "Not an offer ID"),
})

/** Blank form state for a new coupon. */
export const EMPTY_COUPON: CouponFormValues = {
  code: "",
  label: "",
  discounts: {
    "1m": { type: "percent", value: "" },
    "3m": { type: "none", value: "" },
  },
  startsAt: "",
  endsAt: "",
  maxUses: "",
  onePerBuyer: true,
  active: true,
}
