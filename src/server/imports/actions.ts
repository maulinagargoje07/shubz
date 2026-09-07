"use server"

import { revalidateEverything } from "@/lib/revalidate"
import { and, eq, inArray, isNull } from "drizzle-orm"

import { db } from "@/db"
import { contactTags, contacts, importRows, imports, tags } from "@/db/schema"
import { mutate } from "@/lib/audit"
import { parseCsv, parseSheetTimestamp, type ImportableField } from "@/lib/csv"
import { newId } from "@/lib/ids"
import { tryParsePhone } from "@/lib/phone"
import { checkPermission } from "@/lib/session"
import { CONTACT_SOURCES } from "@/lib/validation/contact"
import {
  importCommitSchema,
  importPreviewSchema,
  MAX_IMPORT_ROWS,
} from "@/lib/validation/import"
import type { ActionResult } from "@/lib/validation/shared"

type RowVerdict = {
  rowNumber: number
  raw: Record<string, string>
  status: "VALID" | "DUPLICATE" | "INVALID"
  errorMessage: string | null
  phoneE164: string | null
  fullName: string | null
}

/**
 * Parse, validate and stage a CSV without writing any contacts.
 *
 * Dedupe happens on the NORMALISED phone number, against two things: contacts
 * that already exist (live ones only — a soft-deleted contact has released its
 * number), and earlier rows in the same file. Both matter: a spreadsheet that
 * lists the same person twice would otherwise pass the database check and then
 * violate the unique index halfway through the commit.
 */
export async function previewImport(
  input: unknown
): Promise<
  ActionResult<{
    importId: string
    rowCount: number
    validCount: number
    dupCount: number
    invalidCount: number
    sample: RowVerdict[]
  }>
> {
  const gate = await checkPermission("MANAGE_CONTACTS")
  if (!gate.ok) return gate
  const user = gate.user

  const parsed = importPreviewSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Could not read that file." }
  }

  const { filename, content, columnMap, source, listName } = parsed.data

  const { rows } = parseCsv(content)
  if (rows.length === 0) {
    return { ok: false, error: "That file has no data rows." }
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    return {
      ok: false,
      error: `That file has ${rows.length} rows; the limit is ${MAX_IMPORT_ROWS}. Split it and import in parts.`,
    }
  }

  const pick = (row: Record<string, string>, field: ImportableField): string => {
    const column = (columnMap as Partial<Record<ImportableField, string>>)[field]
    return column ? (row[column] ?? "").trim() : ""
  }

  // Normalise every phone first, then ask the database about all of them at
  // once rather than issuing one query per row.
  const staged = rows.map((row, index) => {
    const fullName = pick(row, "fullName")
    const phoneRaw = pick(row, "phone")
    const parsedPhone = tryParsePhone(phoneRaw)
    return { rowNumber: index + 2, row, fullName, phoneRaw, parsedPhone }
  })

  const candidatePhones = [
    ...new Set(staged.map((s) => s.parsedPhone?.e164).filter((p): p is string => Boolean(p))),
  ]

  const existing = candidatePhones.length
    ? await db
        .select({ phoneE164: contacts.phoneE164 })
        .from(contacts)
        .where(and(inArray(contacts.phoneE164, candidatePhones), isNull(contacts.deletedAt)))
    : []

  const existingPhones = new Set(existing.map((e) => e.phoneE164))
  const seenInFile = new Set<string>()

  const verdicts: RowVerdict[] = staged.map((entry) => {
    const base = { rowNumber: entry.rowNumber, raw: entry.row }

    if (!entry.fullName) {
      return {
        ...base,
        status: "INVALID" as const,
        errorMessage: "Missing name",
        phoneE164: null,
        fullName: null,
      }
    }

    if (!entry.phoneRaw) {
      return {
        ...base,
        status: "INVALID" as const,
        errorMessage: "Missing phone number",
        phoneE164: null,
        fullName: entry.fullName,
      }
    }

    if (!entry.parsedPhone) {
      return {
        ...base,
        status: "INVALID" as const,
        errorMessage: `"${entry.phoneRaw}" is not a valid phone number`,
        phoneE164: null,
        fullName: entry.fullName,
      }
    }

    const e164 = entry.parsedPhone.e164

    if (existingPhones.has(e164)) {
      return {
        ...base,
        status: "DUPLICATE" as const,
        errorMessage: "Already in the database",
        phoneE164: e164,
        fullName: entry.fullName,
      }
    }

    if (seenInFile.has(e164)) {
      return {
        ...base,
        status: "DUPLICATE" as const,
        errorMessage: "Appears earlier in this file",
        phoneE164: e164,
        fullName: entry.fullName,
      }
    }

    seenInFile.add(e164)
    return {
      ...base,
      status: "VALID" as const,
      errorMessage: null,
      phoneE164: e164,
      fullName: entry.fullName,
    }
  })

  const validCount = verdicts.filter((v) => v.status === "VALID").length
  const dupCount = verdicts.filter((v) => v.status === "DUPLICATE").length
  const invalidCount = verdicts.filter((v) => v.status === "INVALID").length

  const importId = await mutate(user, async ({ tx, audit }) => {
    const [batch] = await tx
      .insert(imports)
      .values({
        id: newId(),
        filename,
        uploadedBy: user.id,
        rowCount: verdicts.length,
        validCount,
        dupCount,
        invalidCount,
        columnMap: { ...columnMap, __source: source, __list: listName ?? "" },
        status: "VALIDATED",
      })
      .returning()

    // Staged in chunks; a 5,000-row insert in one statement can exceed the
    // parameter limit.
    for (let i = 0; i < verdicts.length; i += 500) {
      const chunk = verdicts.slice(i, i + 500)
      await tx.insert(importRows).values(
        chunk.map((v) => ({
          id: newId(),
          importId: batch.id,
          rowNumber: v.rowNumber,
          raw: v.raw,
          status: v.status,
          errorMessage: v.errorMessage,
          phoneE164: v.phoneE164,
        }))
      )
    }

    await audit({
      action: "IMPORT_VALIDATED",
      entity: "imports",
      entityId: batch.id,
      after: { filename, rowCount: verdicts.length, validCount, dupCount, invalidCount },
    })

    return batch.id
  })

  revalidateEverything()

  return {
    ok: true,
    data: {
      importId,
      rowCount: verdicts.length,
      validCount,
      dupCount,
      invalidCount,
      sample: verdicts.slice(0, 50),
    },
  }
}

/**
 * Commit a validated import: create a contact for every VALID row.
 *
 * One transaction, so a failure part-way leaves nothing behind. Duplicates and
 * invalid rows are left staged with their reason, which is what makes the
 * import reviewable after the fact.
 */
export async function commitImport(
  input: unknown
): Promise<ActionResult<{ created: number }>> {
  const gate = await checkPermission("MANAGE_CONTACTS")
  if (!gate.ok) return gate
  const user = gate.user

  const parsed = importCommitSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Unknown import." }

  const { importId } = parsed.data

  const batch = await db.query.imports.findFirst({ where: eq(imports.id, importId) })
  if (!batch) return { ok: false, error: "That import no longer exists." }
  if (batch.status === "COMMITTED") {
    return { ok: false, error: "That import has already been committed." }
  }

  const columnMap = (batch.columnMap ?? {}) as Partial<Record<ImportableField, string>> & {
    __source?: string
    __list?: string
  }

  // The source chosen in the wizard was being stored and then ignored, so
  // every imported lead read as "IMPORT" no matter which campaign it came
  // from. Honour it, falling back only when it is missing or unrecognised.
  const importSource = (CONTACT_SOURCES as readonly string[]).includes(
    columnMap.__source ?? ""
  )
    ? (columnMap.__source as (typeof CONTACT_SOURCES)[number])
    : "IMPORT"

  const listName = (columnMap.__list ?? "").trim()

  const staged = await db
    .select()
    .from(importRows)
    .where(and(eq(importRows.importId, importId), eq(importRows.status, "VALID")))

  if (staged.length === 0) {
    return { ok: false, error: "There are no valid rows to import." }
  }

  const created = await mutate(user, async ({ tx, audit }) => {
    let count = 0

    /*
     * The list tag is resolved once, before the loop, and reused. Tag names are
     * unique, so a repeat import into the same list joins the existing tag
     * rather than failing; onConflictDoNothing plus a re-select covers both the
     * first run and every one after it.
     */
    let listTagId: string | null = null
    if (listName) {
      await tx
        .insert(tags)
        .values({ id: newId(), name: listName, colour: "#7c3aed" })
        .onConflictDoNothing()
      const [tag] = await tx.select({ id: tags.id }).from(tags).where(eq(tags.name, listName))
      listTagId = tag?.id ?? null
    }

    for (const row of staged) {
      const raw = (row.raw ?? {}) as Record<string, string>
      const pick = (field: ImportableField): string | null => {
        const column = columnMap[field]
        const value = column ? (raw[column] ?? "").trim() : ""
        return value === "" ? null : value
      }

      const phoneRaw = pick("phone")
      const parsedPhone = tryParsePhone(phoneRaw ?? "")
      // Re-validated at commit: the staged verdict could be stale if someone
      // added this number between preview and commit.
      if (!parsedPhone || !row.phoneE164) continue

      const [contact] = await tx
        .insert(contacts)
        .values({
          id: newId(),
          fullName: pick("fullName") ?? "Unknown",
          phoneE164: parsedPhone.e164,
          phoneRaw,
          altPhone: tryParsePhone(pick("altPhone") ?? "")?.e164 ?? null,
          email: pick("email"),
          city: pick("city"),
          state: pick("state"),
          telegramUsername: pick("telegramUsername"),
          tradingviewUsername: pick("tradingviewUsername"),
          tradingExperience: pick("tradingExperience"),
          // A sheet timestamp that cannot be read is left null rather than
          // guessed at: "we do not know when this lead came in" is honest,
          // and today's date would be a lie that later sorting believes.
          leadCapturedAt: parseSheetTimestamp(pick("capturedAt") ?? ""),
          notes: pick("notes"),
          lifecycleStage: "LEAD",
          leadStatus: "NEW",
          source: importSource,
          createdBy: user.id,
        })
        .onConflictDoNothing()
        .returning()

      if (!contact) {
        // Lost a race for this number; record why rather than failing the batch.
        await tx
          .update(importRows)
          .set({ status: "DUPLICATE", errorMessage: "Added by someone else during import" })
          .where(eq(importRows.id, row.id))
        continue
      }

      if (listTagId) {
        await tx
          .insert(contactTags)
          .values({ contactId: contact.id, tagId: listTagId })
          .onConflictDoNothing()
      }

      await tx
        .update(importRows)
        .set({ status: "IMPORTED", createdContactId: contact.id })
        .where(eq(importRows.id, row.id))

      count++
    }

    await tx
      .update(imports)
      .set({ status: "COMMITTED", committedAt: new Date() })
      .where(eq(imports.id, importId))

    await audit({
      action: "IMPORT_COMMITTED",
      entity: "imports",
      entityId: importId,
      after: { created: count, source: importSource, list: listName || null },
    })

    return count
  })

  revalidateEverything()
  return { ok: true, data: { created } }
}
