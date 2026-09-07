import { z } from "zod"

import {
  optionalDateSchema,
  optionalEmail,
  optionalPhoneSchema,
  optionalText,
  phoneSchema,
  uuidSchema,
} from "./shared"

export const LIFECYCLE_STAGES = [
  "LEAD",
  "REGISTERED",
  "STUDENT",
  "ALUMNI",
  "CHURNED",
] as const

export const CONTACT_SOURCES = [
  "YOUTUBE",
  "INSTAGRAM",
  "TELEGRAM",
  "WEBSITE",
  "REFERRAL",
  "WALK_IN",
  "ADS",
  "IMPORT",
  "OTHER",
] as const

export const contactFormSchema = z.object({
  fullName: z.string().trim().min(2, "Name is required"),
  /** Normalised to E.164 by phoneSchema; phone_raw keeps what was typed. */
  phone: phoneSchema,
  altPhone: optionalPhoneSchema,
  email: optionalEmail,
  city: optionalText,
  state: optionalText,
  lifecycleStage: z.enum(LIFECYCLE_STAGES),
  source: z.enum(CONTACT_SOURCES),
  telegramUsername: optionalText,
  tradingviewUsername: optionalText,
  notes: optionalText,
})

export type ContactFormValues = z.input<typeof contactFormSchema>
export type ContactFormParsed = z.output<typeof contactFormSchema>

export const updateContactSchema = contactFormSchema.extend({ id: uuidSchema })

export const noteSchema = z.object({
  contactId: uuidSchema.optional(),
  enrollmentId: uuidSchema.optional(),
  body: z.string().trim().min(1, "Write something first"),
})

export const consentSchema = z.object({
  contactId: uuidSchema,
  channel: z.enum(["WHATSAPP", "EMAIL", "SMS", "CALL"]),
  action: z.enum(["OPT_IN", "OPT_OUT"]),
  consentText: optionalText,
  source: optionalText,
  occurredAt: optionalDateSchema,
})

/** Query params for the contacts list. Drives server-side pagination. */
export const contactListParamsSchema = z.object({
  q: z.string().trim().optional().default(""),
  stage: z.enum(LIFECYCLE_STAGES).optional(),
  source: z.enum(CONTACT_SOURCES).optional(),
  tag: z.string().optional(),
  /** A batch id, or "none" for contacts enrolled in no batch. */
  batch: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(10).max(200).default(25),
  sort: z.enum(["createdAt", "fullName", "lifecycleStage"]).default("createdAt"),
  dir: z.enum(["asc", "desc"]).default("desc"),
})

export type ContactListParams = z.output<typeof contactListParamsSchema>
