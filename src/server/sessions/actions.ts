"use server"

import { revalidateEverything } from "@/lib/revalidate"
import { eq, sql } from "drizzle-orm"

import { db } from "@/db"
import { batches, classSessions } from "@/db/schema"
import { mutate } from "@/lib/audit"
import { newId } from "@/lib/ids"
import { checkPermission } from "@/lib/session"
import {
  sessionFormSchema,
  sessionSeriesSchema,
  updateSessionSchema,
} from "@/lib/validation/session"
import {
  generateSeriesDates,
  renderTitle,
  type Weekday,
} from "@/lib/sessions/schedule"
import type { ActionResult } from "@/lib/validation/shared"

function fieldErrorsOf(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "")
    if (key && !out[key]) out[key] = issue.message
  }
  return out
}

/**
 * A datetime-local input yields IST wall-clock text with no offset ("2026-09-05T19:30").
 * Attaching +05:30 makes it an unambiguous instant, which Postgres stores as
 * UTC in the timestamptz column. Parsing it without the offset would silently
 * interpret it in the server's timezone.
 */
function istLocalToInstant(local: string): Date {
  const normalised = local.length === 16 ? `${local}:00` : local
  return new Date(`${normalised}+05:30`)
}

export async function createSession(input: unknown): Promise<ActionResult<{ id: string }>> {
  const gate = await checkPermission("MANAGE_PROGRAMS")
  if (!gate.ok) return gate
  const user = gate.user

  const parsed = sessionFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsOf(parsed.error),
    }
  }

  const values = parsed.data

  const [batch] = await db
    .select({ id: batches.id, programId: batches.programId })
    .from(batches)
    .where(eq(batches.id, values.batchId))
    .limit(1)
  if (!batch) return { ok: false, error: "That batch no longer exists." }

  const id = await mutate(user, async ({ tx, audit }) => {
    const [row] = await tx
      .insert(classSessions)
      .values({
        id: newId(),
        batchId: values.batchId,
        seq: values.seq,
        title: values.title,
        scheduledAt: istLocalToInstant(values.scheduledAtLocal),
        durationMinutes: values.durationMinutes,
        meetingLink: values.meetingLink,
        roomOrDesk: values.roomOrDesk,
        recordingLink: values.recordingLink,
        status: values.status,
      })
      .returning()

    await audit({ action: "CREATE", entity: "sessions", entityId: row.id, after: row })
    return row.id
  })

  revalidateEverything()
  return { ok: true, data: { id } }
}

export async function updateSession(input: unknown): Promise<ActionResult<{ id: string }>> {
  const gate = await checkPermission("MANAGE_PROGRAMS")
  if (!gate.ok) return gate
  const user = gate.user

  const parsed = updateSessionSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsOf(parsed.error),
    }
  }

  const values = parsed.data

  const before = await db.query.classSessions.findFirst({
    where: eq(classSessions.id, values.id),
  })
  if (!before) return { ok: false, error: "That session no longer exists." }

  const [batch] = await db
    .select({ programId: batches.programId })
    .from(batches)
    .where(eq(batches.id, values.batchId))
    .limit(1)

  await mutate(user, async ({ tx, audit }) => {
    const [after] = await tx
      .update(classSessions)
      .set({
        seq: values.seq,
        title: values.title,
        scheduledAt: istLocalToInstant(values.scheduledAtLocal),
        durationMinutes: values.durationMinutes,
        meetingLink: values.meetingLink,
        roomOrDesk: values.roomOrDesk,
        recordingLink: values.recordingLink,
        status: values.status,
        updatedAt: new Date(),
      })
      .where(eq(classSessions.id, values.id))
      .returning()

    await audit({ action: "UPDATE", entity: "sessions", entityId: values.id, before, after })
  })

  if (batch)  revalidateEverything()
  return { ok: true, data: { id: values.id } }
}

export async function deleteSession(id: string): Promise<ActionResult> {
  const gate = await checkPermission("DELETE_RECORDS")
  if (!gate.ok) return gate
  const user = gate.user

  const before = await db.query.classSessions.findFirst({
    where: eq(classSessions.id, id),
  })
  if (!before) return { ok: false, error: "That session no longer exists." }

  // Sessions carry no financial record, so a genuine delete is fine here —
  // attendance rows cascade with it.
  await mutate(user, async ({ tx, audit }) => {
    await tx.delete(classSessions).where(eq(classSessions.id, id))
    await audit({ action: "DELETE", entity: "sessions", entityId: id, before })
  })

  revalidateEverything()
  return { ok: true, data: undefined }
}


/**
 * Create a whole run of sessions in one go.
 *
 * Sequence numbers are assigned here, continuing from the batch's current
 * maximum, rather than being typed per session — `(batch_id, seq)` is unique,
 * so hand-entered numbers were a collision waiting to happen and produced a
 * raw constraint error when two people scheduled at once.
 *
 * The whole run is one transaction: a partially created series would leave the
 * numbering broken and force the user to work out which classes already exist.
 */
export async function createSessionSeries(
  input: unknown
): Promise<ActionResult<{ created: number; first: string; last: string }>> {
  const gate = await checkPermission("MANAGE_PROGRAMS")
  if (!gate.ok) return gate
  const user = gate.user

  const parsed = sessionSeriesSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsOf(parsed.error),
    }
  }

  const values = parsed.data

  const [batch] = await db
    .select({
      id: batches.id,
      programId: batches.programId,
      endDate: batches.endDate,
    })
    .from(batches)
    .where(eq(batches.id, values.batchId))
    .limit(1)
  if (!batch) return { ok: false, error: "That batch no longer exists." }

  // The batch's own end date caps the run, so scheduling twenty classes into a
  // batch that finishes next month quietly stops at the end rather than
  // creating sessions past it.
  const dates = generateSeriesDates({
    startDate: values.startDate,
    weekdays: values.weekdays as Weekday[],
    count: values.count,
    endDate: batch.endDate,
  })

  if (dates.length === 0) {
    return {
      ok: false,
      error: "That pattern produces no sessions before the batch ends.",
      fieldErrors: { startDate: "No dates match" },
    }
  }

  const created = await mutate(user, async ({ tx, audit }) => {
    const [{ maxSeq }] = await tx
      .select({ maxSeq: sql<number | null>`max(${classSessions.seq})` })
      .from(classSessions)
      .where(eq(classSessions.batchId, values.batchId))

    const startSeq = Number(maxSeq ?? 0) + 1

    const rows = dates.map((date, index) => {
      const seq = startSeq + index
      return {
        id: newId(),
        batchId: values.batchId,
        seq,
        title: renderTitle(values.titleTemplate, seq),
        scheduledAt: istLocalToInstant(`${date}T${values.time}`),
        durationMinutes: values.durationMinutes,
        meetingLink: values.meetingLink,
        roomOrDesk: values.roomOrDesk,
        status: "SCHEDULED" as const,
      }
    })

    await tx.insert(classSessions).values(rows)

    await audit({
      action: "SESSION_SERIES_CREATED",
      entity: "batches",
      entityId: values.batchId,
      after: {
        count: rows.length,
        from: dates[0],
        to: dates[dates.length - 1],
        weekdays: values.weekdays,
        time: values.time,
      },
    })

    return rows.length
  })

  revalidateEverything()
  return {
    ok: true,
    data: { created, first: dates[0], last: dates[dates.length - 1] },
  }
}
