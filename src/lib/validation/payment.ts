import { z } from "zod"

import { dateSchema, optionalText, rupeesSchema, uuidSchema } from "./shared"

export const PAYMENT_METHODS = [
  "UPI",
  "BANK_TRANSFER",
  "CASH",
  "CARD",
  "RAZORPAY",
  "CHEQUE",
  "OTHER",
] as const

export const paymentFormSchema = z.object({
  enrollmentId: uuidSchema,
  amountRupees: rupeesSchema.refine((p) => p > 0, "Amount must be more than zero"),
  paidOn: dateSchema,
  method: z.enum(PAYMENT_METHODS),
  referenceNo: optionalText,
  notes: optionalText,
})

export type PaymentFormValues = z.input<typeof paymentFormSchema>

/** Filters on the payments list. */
export const paymentListParamsSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  method: z.enum(PAYMENT_METHODS).optional(),
  programId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(10).max(200).default(25),
})

export type PaymentListParams = z.output<typeof paymentListParamsSchema>

/** Soft-delete a payment. The ledger is append-only, so nothing is erased. */
export const voidPaymentSchema = z.object({
  id: uuidSchema,
  reason: z.string().trim().min(3, "Give a reason for voiding this payment"),
})
