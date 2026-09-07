import { z } from "zod"

import { optionalText, optionalUrl, uuidSchema } from "./shared"
import { MAX_SESSIONS_PER_SERIES } from "@/lib/sessions/schedule"

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

/**
 * Scheduling a whole run of classes at once.
 *
 * Replaces filling the single-session form once per class. The sequence
 * numbers are assigned server-side from the batch's current maximum, so they
 * cannot collide with existing sessions or with each other.
 */
export const sessionSeriesSchema = z.object({
  batchId: uuidSchema,
  /** "{n}" is replaced by each session's number. */
  titleTemplate: z.string().trim().min(2, "Give the sessions a title"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a start date"),
  /** IST wall-clock, e.g. "19:30". Applies to every session in the run. */
  time: z.string().regex(/^\d{2}:\d{2}$/, "Pick a time"),
  weekdays: z
    .array(z.number().int().min(0).max(6))
    .max(7)
    .default([]),
  count: z.coerce.number().int().min(1, "At least one").max(MAX_SESSIONS_PER_SERIES),
  durationMinutes: z.coerce.number().int().min(5).max(600).default(90),
  meetingLink: optionalUrl,
  roomOrDesk: optionalText,
})

export type SessionSeriesValues = z.input<typeof sessionSeriesSchema>
export type SessionSeriesParsed = z.output<typeof sessionSeriesSchema>
