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
})

export const importCommitSchema = z.object({
  importId: uuidSchema,
})

export type ImportPreviewValues = z.infer<typeof importPreviewSchema>

/** Guard against someone pasting a 200k-row export into a single request. */
export const MAX_IMPORT_ROWS = 5000
