"use server"

import { revalidateEverything } from "@/lib/revalidate"
import { eq } from "drizzle-orm"

import { db } from "@/db"
import { programs } from "@/db/schema"
import { mutate } from "@/lib/audit"
import { newId } from "@/lib/ids"
import { splitProgramKind } from "@/lib/programs"
import { checkPermission } from "@/lib/session"
import { programFormSchema, updateProgramSchema } from "@/lib/validation/program"
import type { ActionResult } from "@/lib/validation/shared"
import { getProgramByCode } from "./queries"

function fieldErrorsOf(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "")
    if (key && !out[key]) out[key] = issue.message
  }
  return out
}

export async function createProgram(input: unknown): Promise<ActionResult<{ id: string }>> {
  const gate = await checkPermission("MANAGE_PROGRAMS")
  if (!gate.ok) return gate
  const user = gate.user

  const parsed = programFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsOf(parsed.error),
    }
  }

  const values = parsed.data
  const clash = await getProgramByCode(values.code)
  if (clash) {
    return {
      ok: false,
      error: "That code is taken.",
      fieldErrors: { code: `"${clash.name}" already uses this code.` },
    }
  }

  // The form's single combined selector writes BOTH columns.
  const { type, deliveryMode } = splitProgramKind(values.kind)

  const id = await mutate(user, async ({ tx, audit }) => {
    const [row] = await tx
      .insert(programs)
      .values({
        id: newId(),
        name: values.name,
        code: values.code,
        type,
        deliveryMode,
        description: values.description,
        defaultFeePaise: values.defaultFeeRupees,
        defaultDurationDays: values.defaultDurationDays,
        defaultBillingType: values.defaultBillingType,
        defaultBillingCycle:
          values.defaultBillingType === "RECURRING"
            ? (values.defaultBillingCycle ?? null)
            : null,
        status: values.status,
        createdBy: user.id,
      })
      .returning()

    await audit({ action: "CREATE", entity: "programs", entityId: row.id, after: row })
    return row.id
  })

  revalidateEverything()
  return { ok: true, data: { id } }
}

export async function updateProgram(input: unknown): Promise<ActionResult<{ id: string }>> {
  const gate = await checkPermission("MANAGE_PROGRAMS")
  if (!gate.ok) return gate
  const user = gate.user

  const parsed = updateProgramSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsOf(parsed.error),
    }
  }

  const values = parsed.data
  const clash = await getProgramByCode(values.code, values.id)
  if (clash) {
    return {
      ok: false,
      error: "That code is taken.",
      fieldErrors: { code: `"${clash.name}" already uses this code.` },
    }
  }

  const before = await db.query.programs.findFirst({ where: eq(programs.id, values.id) })
  if (!before) return { ok: false, error: "That program no longer exists." }

  const { type, deliveryMode } = splitProgramKind(values.kind)

  await mutate(user, async ({ tx, audit }) => {
    const [after] = await tx
      .update(programs)
      .set({
        name: values.name,
        code: values.code,
        type,
        deliveryMode,
        description: values.description,
        defaultFeePaise: values.defaultFeeRupees,
        defaultDurationDays: values.defaultDurationDays,
        defaultBillingType: values.defaultBillingType,
        defaultBillingCycle:
          values.defaultBillingType === "RECURRING"
            ? (values.defaultBillingCycle ?? null)
            : null,
        status: values.status,
        updatedAt: new Date(),
      })
      .where(eq(programs.id, values.id))
      .returning()

    await audit({
      action: "UPDATE",
      entity: "programs",
      entityId: values.id,
      before,
      after,
    })
  })

  revalidateEverything()
  return { ok: true, data: { id: values.id } }
}
