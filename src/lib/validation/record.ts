import { z } from "zod"

import {
  dateSchema,
  optionalEmail,
  optionalRupeesSchema,
  optionalText,
  phoneSchema,
  rupeesSchema,
} from "./shared"
import { PAYMENT_METHODS } from "./payment"

/**
 * The quick student-record form.
 *
 * One form that creates the contact, the enrollment and the opening payment
 * together. Adding a student previously meant five screens — contact, program,
 * batch, enrollment, payment — which is the wrong shape for the job, since in
 * practice all of that is known at once when someone signs up at the desk.
 *
 * The four program options are the ones this business actually sells. They are
 * resolved server-side to real program rows, so everything downstream — fees,
 * receipts, attendance, the dashboard split by type and mode — keeps working
 * exactly as before.
 */
export const RECORD_PROGRAM_KINDS = [
  { value: "MENTORSHIP__ONLINE", label: "Mentorship — Online" },
  { value: "MENTORSHIP__OFFLINE", label: "Mentorship — Offline" },
  { value: "TRADING_FLOOR__ONLINE", label: "Trading Floor — Online" },
  { value: "TRADING_FLOOR__OFFLINE", label: "Trading Floor — Offline" },
] as const

export type RecordProgramKind = (typeof RECORD_PROGRAM_KINDS)[number]["value"]

const RECORD_KIND_VALUES = RECORD_PROGRAM_KINDS.map((k) => k.value) as [
  RecordProgramKind,
  ...RecordProgramKind[],
]

export const studentRecordSchema = z
  .object({
    // --- the student ---
    fullName: z.string().trim().min(2, "Student name is required"),
    phone: phoneSchema,
    email: optionalEmail,
    city: optionalText,

    // --- what they signed up for ---
    programKind: z.enum(RECORD_KIND_VALUES),
    /** Free text like "B1". Resolved to a real batch under the program. */
    batchLabel: optionalText,

    // --- money ---
    totalFeesRupees: rupeesSchema,
    feesPaidRupees: optionalRupeesSchema,
    /** Only meaningful when an opening payment is being recorded. */
    paymentMethod: z.enum(PAYMENT_METHODS).default("UPI"),
    paymentReference: optionalText,

    enrolledOn: dateSchema,
    notes: optionalText,
  })
  .superRefine((val, ctx) => {
    // Outstanding is derived, so an opening payment larger than the fee would
    // put the enrollment permanently in credit — almost always a typo.
    if (val.feesPaidRupees > val.totalFeesRupees) {
      ctx.addIssue({
        code: "custom",
        path: ["feesPaidRupees"],
        message: "Fees paid cannot exceed the total fees",
      })
    }
  })

export type StudentRecordValues = z.input<typeof studentRecordSchema>
export type StudentRecordParsed = z.output<typeof studentRecordSchema>

/**
 * Editing an existing record.
 *
 * Fees PAID is deliberately absent. Money in is the payments ledger, which is
 * append-only — correcting it means voiding a payment and recording a new one,
 * so the history of how a balance came to be survives. Letting someone retype
 * "fees paid" here would silently rewrite that.
 */
export const studentRecordEditSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string().trim().min(2, "Student name is required"),
  phone: phoneSchema,
  email: optionalEmail,
  city: optionalText,
  programKind: z.enum(RECORD_KIND_VALUES),
  batchLabel: optionalText,
  totalFeesRupees: rupeesSchema,
  enrolledOn: dateSchema,
  status: z.enum(["ACTIVE", "PAUSED", "COMPLETED", "DROPPED", "CANCELLED"]),
  notes: optionalText,
})

export type StudentRecordEditValues = z.input<typeof studentRecordEditSchema>
export type StudentRecordEditParsed = z.output<typeof studentRecordEditSchema>
