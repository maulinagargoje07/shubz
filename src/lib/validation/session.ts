import { z } from "zod"

import { optionalText, optionalUrl, uuidSchema } from "./shared"

export const SESSION_STATUSES = [
  "SCHEDULED",
  "LIVE",
  "COMPLETED",
  "CANCELLED",
] as const

export const sessionFormSchema = z.object({
  batchId: uuidSchema,
  seq: z.coerce.number().int().min(1, "Sequence starts at 1"),
  title: z.string().trim().min(2, "Title is required"),
  /**
   * From a datetime-local input, so it arrives as IST wall-clock text with no
   * offset. The action attaches +05:30 before storing, keeping the column
   * timestamptz in UTC.
   */
  scheduledAtLocal: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, "Pick a date and time"),
  durationMinutes: z.coerce.number().int().min(5).max(600).default(90),
  meetingLink: optionalUrl,
  roomOrDesk: optionalText,
  recordingLink: optionalUrl,
  status: z.enum(SESSION_STATUSES),
})

export type SessionFormValues = z.input<typeof sessionFormSchema>
export type SessionFormParsed = z.output<typeof sessionFormSchema>

export const updateSessionSchema = sessionFormSchema.extend({ id: uuidSchema })
