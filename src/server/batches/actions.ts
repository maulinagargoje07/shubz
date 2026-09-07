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
import { getBatchByCode, getBatchByName } from "./queries"

/** Postgres unique-violation SQLSTATE. */
const UNIQUE_VIOLATION = "23505"

/**
 * Turn a lost race into the same sentence the pre-check would have produced.
 *
 * The pre-checks are a courtesy: between checking and inserting, another
 * request can create the same batch. The indexes are the real guarantee, so
 * their violations are translated rather than surfacing as a 500.
 */
function translateBatchConflict(error: unknown): ActionResult<never> | null {
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error) ||
    (error as { code?: string }).code !== UNIQUE_VIOLATION
  ) {
    return null
  }

  const { detail, message } = error as { detail?: string; message?: string }
  const text = String(detail ?? message ?? "")

  if (text.includes("batches_program_name_uq")) {
    return {
      ok: false,
      error: "This program already has a batch with that name.",
      fieldErrors: { name: "Already used. Pick a different name." },
    }
  }
  if (text.includes("code")) {
    return {
      ok: false,
      error: "That code is taken.",
      fieldErrors: { code: "Already used. Pick a different code." },
    }
  }
  return { ok: false, error: "That batch already exists." }
}

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

  // The name is what people pick from in every dropdown, so it has to be
  // unique within the program. `batches_program_name_uq` enforces it; this
  // check exists so the user gets a sentence instead of a constraint error.
  const nameClash = await getBatchByName(values.programId, values.name, undefined)
  if (nameClash) {
    return {
      ok: false,
      error: `This program already has a batch called "${nameClash.name}".`,
      fieldErrors: {
        name: `Already used by ${nameClash.code}. Pick a different name.`,
      },
    }
  }

  const isOnline = actualMode === "ONLINE"

  try {
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
  } catch (error) {
    const conflict = translateBatchConflict(error)
    if (conflict) return conflict
    throw error
  }
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

  // The name is what people pick from in every dropdown, so it has to be
  // unique within the program. `batches_program_name_uq` enforces it; this
  // check exists so the user gets a sentence instead of a constraint error.
  const nameClash = await getBatchByName(values.programId, values.name, values.id)
  if (nameClash) {
    return {
      ok: false,
      error: `This program already has a batch called "${nameClash.name}".`,
      fieldErrors: {
        name: `Already used by ${nameClash.code}. Pick a different name.`,
      },
    }
  }

  const before = await db.query.batches.findFirst({ where: eq(batches.id, values.id) })
  if (!before) return { ok: false, error: "That batch no longer exists." }

  const isOnline = actualMode === "ONLINE"

  try {
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
  } catch (error) {
    const conflict = translateBatchConflict(error)
    if (conflict) return conflict
    throw error
  }
}
