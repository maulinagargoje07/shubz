import { z } from "zod"

import {
  optionalDateSchema,
  optionalPositiveInt,
  optionalText,
  optionalUrl,
  uuidSchema,
} from "./shared"

export const BATCH_STATUSES = [
  "PLANNED",
  "OPEN",
  "RUNNING",
  "COMPLETED",
  "CANCELLED",
] as const

const batchBase = z.object({
  programId: uuidSchema,
  name: z.string().trim().min(2, "Name is required"),
  code: z
    .string()
    .trim()
    .min(2, "Code is required")
    .regex(/^[A-Z0-9-]+$/, "Use capitals, digits and hyphens only")
    .max(32),
  startDate: optionalDateSchema,
  endDate: optionalDateSchema,
  timingText: optionalText,
  mentorUserId: uuidSchema.nullable().optional().default(null),
  capacity: optionalPositiveInt,

  meetingLink: optionalUrl,
  venueName: optionalText,
  venueAddress: optionalText,
  seatCapacity: optionalPositiveInt,

  status: z.enum(BATCH_STATUSES),

  /**
   * Not stored — carried on the form so validation knows which branch applies.
   * The server re-reads the parent program's real delivery mode rather than
   * trusting this, so a tampered field cannot bypass the rule.
   */
  deliveryMode: z.enum(["ONLINE", "OFFLINE"]),
})

/**
 * A batch's required fields depend on how its parent program is delivered:
 * an online batch needs somewhere to join, an offline one needs somewhere to
 * turn up. The form shows one branch or the other; this enforces it.
 */
export const batchFormSchema = batchBase.superRefine((val, ctx) => {
  if (val.deliveryMode === "ONLINE") {
    if (!val.meetingLink) {
      ctx.addIssue({
        code: "custom",
        path: ["meetingLink"],
        message: "An online batch needs a meeting link",
      })
    }
  } else {
    if (!val.venueName) {
      ctx.addIssue({
        code: "custom",
        path: ["venueName"],
        message: "An offline batch needs a venue",
      })
    }
  }

  if (val.startDate && val.endDate && val.endDate < val.startDate) {
    ctx.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "End date cannot be before the start date",
    })
  }
})

export type BatchFormValues = z.input<typeof batchBase>

export const updateBatchSchema = z.intersection(
  batchFormSchema,
  z.object({ id: uuidSchema })
)
