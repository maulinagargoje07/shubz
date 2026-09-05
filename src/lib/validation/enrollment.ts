import { z } from "zod"

import {
  dateSchema,
  optionalDateSchema,
  optionalRupeesSchema,
  optionalText,
  rupeesSchema,
  uuidSchema,
} from "./shared"
import { BILLING_CYCLE_VALUES } from "./program"

export const ENROLLMENT_STATUSES = [
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "DROPPED",
  "CANCELLED",
] as const

export const enrollmentFormSchema = z
  .object({
    contactId: uuidSchema,
    programId: uuidSchema,
    /** Null is legitimate: a Trading Floor membership may have no batch. */
    batchId: uuidSchema.nullable().optional().default(null),

    status: z.enum(ENROLLMENT_STATUSES).default("ACTIVE"),
    enrolledOn: dateSchema,
    startDate: optionalDateSchema,
    endDate: optionalDateSchema,

    /** For RECURRING this is ONE cycle's fee, not a contract total. */
    feeRupees: rupeesSchema,
    discountRupees: optionalRupeesSchema,

    billingType: z.enum(["ONE_TIME", "RECURRING"]),
    billingCycle: z.enum(BILLING_CYCLE_VALUES).nullable().optional(),

    /** ONE_TIME only. 1 means pay in full. */
    installments: z.coerce.number().int().min(1).max(36).default(1),

    /** Offline Trading Floor desk. */
    seatNumber: optionalText,

    assignedMentorUserId: uuidSchema.nullable().optional().default(null),
    notes: optionalText,
  })
  .superRefine((val, ctx) => {
    if (val.billingType === "RECURRING" && !val.billingCycle) {
      ctx.addIssue({
        code: "custom",
        path: ["billingCycle"],
        message: "Choose a billing cycle for a recurring enrollment",
      })
    }

    if (val.discountRupees > val.feeRupees) {
      ctx.addIssue({
        code: "custom",
        path: ["discountRupees"],
        message: "Discount cannot exceed the fee",
      })
    }

    if (val.startDate && val.endDate && val.endDate < val.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date cannot be before the start date",
      })
    }
  })

export type EnrollmentFormValues = z.input<typeof enrollmentFormSchema>
export type EnrollmentFormParsed = z.output<typeof enrollmentFormSchema>

export const updateEnrollmentSchema = z.intersection(
  enrollmentFormSchema,
  z.object({ id: uuidSchema })
)

export const enrollmentStatusSchema = z.object({
  id: uuidSchema,
  status: z.enum(ENROLLMENT_STATUSES),
})
