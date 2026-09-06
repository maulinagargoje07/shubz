"use server"

import { revalidateEverything } from "@/lib/revalidate"
import { eq } from "drizzle-orm"

import { db } from "@/db"
import { batches, programs } from "@/db/schema"
import { mutate } from "@/lib/audit"
import { newId } from "@/lib/ids"
import { checkPermission } from "@/lib/session"
import { batchFormSchema, updateBatchSchema } from "@/lib/validation/batch"
import type { ActionResult } from "@/lib/validation/shared"
import { getBatchByCode } from "./queries"

function fieldErrorsOf(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "")
    if (key && !out[key]) out[key] = issue.message
  }
  return out
}

/**
 * The form carries a `deliveryMode` so client-side validation knows which
 * branch applies, but it is NOT trusted: the parent program's real mode is
 * re-read here, so a tampered field cannot make an offline batch skip its
 * venue. Fields belonging to the other branch are cleared rather than stored.
 */
async function resolveDeliveryMode(programId: string) {
  const [program] = await db
    .select({ deliveryMode: programs.deliveryMode })
    .from(programs)
    .where(eq(programs.id, programId))
    .limit(1)
  return program?.deliveryMode ?? null
}

export async function createBatch(input: unknown): Promise<ActionResult<{ id: string }>> {
  const gate = await checkPermission("MANAGE_PROGRAMS")
  if (!gate.ok) return gate
  const user = gate.user

  const candidate = input as { programId?: string }
  const actualMode = candidate.programId
    ? await resolveDeliveryMode(candidate.programId)
    : null
  if (!actualMode) return { ok: false, error: "That program no longer exists." }

  const parsed = batchFormSchema.safeParse({ ...(input as object), deliveryMode: actualMode })
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsOf(parsed.error),
    }
  }

  const values = parsed.data
  const clash = await getBatchByCode(values.code)
  if (clash) {
    return {
      ok: false,
      error: "That code is taken.",
      fieldErrors: { code: `"${clash.name}" already uses this code.` },
    }
  }

  const isOnline = actualMode === "ONLINE"

  const id = await mutate(user, async ({ tx, audit }) => {
    const [row] = await tx
      .insert(batches)
      .values({
        id: newId(),
        programId: values.programId,
        name: values.name,
        code: values.code,
        startDate: values.startDate,
        endDate: values.endDate,
        timingText: values.timingText,
        mentorUserId: values.mentorUserId ?? null,
        capacity: values.capacity,
        // Only the branch that applies is stored.
        meetingLink: isOnline ? values.meetingLink : null,
        venueName: isOnline ? null : values.venueName,
        venueAddress: isOnline ? null : values.venueAddress,
        seatCapacity: isOnline ? null : values.seatCapacity,
        status: values.status,
      })
      .returning()

    await audit({ action: "CREATE", entity: "batches", entityId: row.id, after: row })
    return row.id
  })

  revalidateEverything()
  return { ok: true, data: { id } }
}

export async function updateBatch(input: unknown): Promise<ActionResult<{ id: string }>> {
  const gate = await checkPermission("MANAGE_PROGRAMS")
  if (!gate.ok) return gate
  const user = gate.user

  const candidate = input as { programId?: string; id?: string }
  const actualMode = candidate.programId
    ? await resolveDeliveryMode(candidate.programId)
    : null
  if (!actualMode) return { ok: false, error: "That program no longer exists." }

  const parsed = updateBatchSchema.safeParse({
    ...(input as object),
    deliveryMode: actualMode,
  })
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsOf(parsed.error),
    }
  }

  const values = parsed.data
  const clash = await getBatchByCode(values.code, values.id)
  if (clash) {
    return {
      ok: false,
      error: "That code is taken.",
      fieldErrors: { code: `"${clash.name}" already uses this code.` },
    }
  }

  const before = await db.query.batches.findFirst({ where: eq(batches.id, values.id) })
  if (!before) return { ok: false, error: "That batch no longer exists." }

  const isOnline = actualMode === "ONLINE"

  await mutate(user, async ({ tx, audit }) => {
    const [after] = await tx
      .update(batches)
      .set({
        name: values.name,
        code: values.code,
        startDate: values.startDate,
        endDate: values.endDate,
        timingText: values.timingText,
        mentorUserId: values.mentorUserId ?? null,
        capacity: values.capacity,
        meetingLink: isOnline ? values.meetingLink : null,
        venueName: isOnline ? null : values.venueName,
        venueAddress: isOnline ? null : values.venueAddress,
        seatCapacity: isOnline ? null : values.seatCapacity,
        status: values.status,
        updatedAt: new Date(),
      })
      .where(eq(batches.id, values.id))
      .returning()

    await audit({ action: "UPDATE", entity: "batches", entityId: values.id, before, after })
  })

  revalidateEverything()
  return { ok: true, data: { id: values.id } }
}
