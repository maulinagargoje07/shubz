import { z } from "zod"

import { PROGRAM_KIND_VALUES } from "@/lib/programs"
import { optionalPositiveInt, optionalText, rupeesSchema, uuidSchema } from "./shared"

export const PROGRAM_STATUSES = [
  "DRAFT",
  "OPEN",
  "ACTIVE",
  "CLOSED",
  "ARCHIVED",
] as const

export const BILLING_CYCLE_VALUES = [
  "MONTHLY",
  "QUARTERLY",
  "HALF_YEARLY",
  "ANNUAL",
] as const

/**
 * The program form takes ONE combined kind ("TRADING_FLOOR__OFFLINE") and the
 * action splits it into the two columns. Storage keeps them independent; the
 * user never sees two dropdowns.
 */
export const programFormSchema = z
  .object({
    name: z.string().trim().min(2, "Name is required"),
    code: z
      .string()
      .trim()
      .min(2, "Code is required")
      .regex(/^[A-Z0-9-]+$/, "Use capitals, digits and hyphens only")
      .max(32),
    kind: z.enum(PROGRAM_KIND_VALUES),
    description: optionalText,
    defaultFeeRupees: rupeesSchema,
    defaultDurationDays: optionalPositiveInt,
    defaultBillingType: z.enum(["ONE_TIME", "RECURRING"]),
    defaultBillingCycle: z.enum(BILLING_CYCLE_VALUES).nullable().optional(),
    status: z.enum(PROGRAM_STATUSES),
  })
  .superRefine((val, ctx) => {
    // A recurring program without a cycle has no way to say when the next
    // payment falls due.
    if (val.defaultBillingType === "RECURRING" && !val.defaultBillingCycle) {
      ctx.addIssue({
        code: "custom",
        path: ["defaultBillingCycle"],
        message: "Choose a billing cycle for a recurring program",
      })
    }
  })

/**
 * Input and output differ because the schema transforms: `defaultFeeRupees`
 * arrives as the text a human typed and leaves as integer paise. Forms are
 * typed on the input, server actions on the output.
 */
export type ProgramFormValues = z.input<typeof programFormSchema>
export type ProgramFormParsed = z.output<typeof programFormSchema>

export const updateProgramSchema = z.intersection(
  programFormSchema,
  z.object({ id: uuidSchema })
)
