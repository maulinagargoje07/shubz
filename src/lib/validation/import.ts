import { z } from "zod"

import { IMPORTABLE_FIELDS } from "@/lib/csv"
import { CONTACT_SOURCES } from "./contact"
import { uuidSchema } from "./shared"

const fieldKeys = IMPORTABLE_FIELDS.map((f) => f.key) as [string, ...string[]]

export const importPreviewSchema = z.object({
  filename: z.string().min(1),
  /** The raw file text. Kept small by the row cap below. */
  content: z.string().min(1, "The file is empty"),
  columnMap: z.record(z.enum(fieldKeys), z.string()),
  source: z.enum(CONTACT_SOURCES).default("IMPORT"),
  /**
   * Optional name for the batch of people this file brings in, applied as a
   * tag. It is what turns one import into a list that can be messaged later —
   * "Webinar 12 Sep" rather than an anonymous heap of new leads.
   */
  listName: z.string().trim().max(60).optional(),
})

export const importCommitSchema = z.object({
  importId: uuidSchema,
})

export type ImportPreviewValues = z.infer<typeof importPreviewSchema>

/** Guard against someone pasting a 200k-row export into a single request. */
export const MAX_IMPORT_ROWS = 5000
