"use server"

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"

import { db } from "@/db"
import { batches, classSessions } from "@/db/schema"
import { mutate } from "@/lib/audit"
import { newId } from "@/lib/ids"
import { requireUser } from "@/lib/session"
import { sessionFormSchema, updateSessionSchema } from "@/lib/validation/session"
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
  const user = await requireUser()

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

  revalidatePath(`/programs/${batch.programId}/batches/${values.batchId}`)
  revalidatePath("/sessions")
  return { ok: true, data: { id } }
}

export async function updateSession(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser()

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

  if (batch) revalidatePath(`/programs/${batch.programId}/batches/${values.batchId}`)
  revalidatePath("/sessions")
  return { ok: true, data: { id: values.id } }
}

export async function deleteSession(id: string): Promise<ActionResult> {
  const user = await requireUser()

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

  revalidatePath("/sessions")
  return { ok: true, data: undefined }
}
