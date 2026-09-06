"use server"

import { revalidateEverything } from "@/lib/revalidate"
import { and, eq, isNull } from "drizzle-orm"

import { db } from "@/db"
import { enrollments, paymentSchedule, payments, programs } from "@/db/schema"
import { mutate } from "@/lib/audit"
import { planSchedule } from "@/lib/billing"
import { newId } from "@/lib/ids"
import { requireUser } from "@/lib/session"
import {
  enrollmentFormSchema,
  enrollmentStatusSchema,
  updateEnrollmentSchema,
} from "@/lib/validation/enrollment"
import type { ActionResult } from "@/lib/validation/shared"
import { reconcileSchedule } from "@/server/payments/ledger"

const UNIQUE_VIOLATION = "23505"

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === UNIQUE_VIOLATION
  )
}

function fieldErrorsOf(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "")
    if (key && !out[key]) out[key] = issue.message
  }
  return out
}

/** Translate the partial unique indexes into messages a human can act on. */
function translateConstraint(error: unknown): string | null {
  const message = String((error as { detail?: string; message?: string })?.detail ?? (error as Error)?.message ?? "")
  if (message.includes("enrollments_batch_seat_live_uq")) {
    return "That seat is already taken in this batch."
  }
  if (message.includes("enrollments_contact_batch_live_uq")) {
    return "This person is already enrolled in that batch."
  }
  return null
}

export async function createEnrollment(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser()

  const parsed = enrollmentFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsOf(parsed.error),
    }
  }

  const values = parsed.data

  // A seat only means something for an offline batch.
  const [program] = await db
    .select({ deliveryMode: programs.deliveryMode, type: programs.type })
    .from(programs)
    .where(eq(programs.id, values.programId))
    .limit(1)
  if (!program) return { ok: false, error: "That program no longer exists." }

  const seatNumber =
    program.deliveryMode === "OFFLINE" ? (values.seatNumber ?? null) : null

  const startDate = values.startDate ?? values.enrolledOn

  try {
    const id = await mutate(user, async ({ tx, audit }) => {
      const [row] = await tx
        .insert(enrollments)
        .values({
          id: newId(),
          contactId: values.contactId,
          programId: values.programId,
          batchId: values.batchId ?? null,
          status: values.status,
          enrolledOn: values.enrolledOn,
          startDate,
          endDate: values.endDate,
          feeTotalPaise: values.feeRupees,
          discountPaise: values.discountRupees,
          billingType: values.billingType,
          billingCycle:
            values.billingType === "RECURRING" ? (values.billingCycle ?? null) : null,
          seatNumber,
          assignedMentorUserId: values.assignedMentorUserId ?? null,
          notes: values.notes,
          createdBy: user.id,
        })
        .returning()

      // Materialise what is owed and when. One representation for both
      // one-time installments and recurring cycles.
      const planned = planSchedule({
        billingType: values.billingType,
        billingCycle: values.billingCycle ?? null,
        feeTotalPaise: values.feeRupees,
        discountPaise: values.discountRupees,
        startDate,
        endDate: values.endDate,
        installments: values.installments,
      })

      if (planned.length > 0) {
        await tx.insert(paymentSchedule).values(
          planned.map((p) => ({
            id: newId(),
            enrollmentId: row.id,
            seq: p.seq,
            dueDate: p.dueDate,
            amountPaise: p.amountPaise,
            status: "PENDING" as const,
          }))
        )
      }

      // Sets next_due_date and marks anything already past due as OVERDUE.
      await reconcileSchedule(tx, row.id)

      await audit({ action: "CREATE", entity: "enrollments", entityId: row.id, after: row })
      return row.id
    })

  revalidateEverything()
    return { ok: true, data: { id } }
  } catch (error) {
    if (isUniqueViolation(error)) {
      const message = translateConstraint(error)
      if (message) {
        return {
          ok: false,
          error: message,
          fieldErrors: message.includes("seat")
            ? { seatNumber: message }
            : { batchId: message },
        }
      }
    }
    throw error
  }
}

export async function updateEnrollment(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser()

  const parsed = updateEnrollmentSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsOf(parsed.error),
    }
  }

  const values = parsed.data

  const before = await db.query.enrollments.findFirst({
    where: and(eq(enrollments.id, values.id), isNull(enrollments.deletedAt)),
  })
  if (!before) return { ok: false, error: "That enrollment no longer exists." }

  const [program] = await db
    .select({ deliveryMode: programs.deliveryMode })
    .from(programs)
    .where(eq(programs.id, values.programId))
    .limit(1)

  const seatNumber =
    program?.deliveryMode === "OFFLINE" ? (values.seatNumber ?? null) : null

  try {
    await mutate(user, async ({ tx, audit }) => {
      const [after] = await tx
        .update(enrollments)
        .set({
          batchId: values.batchId ?? null,
          status: values.status,
          enrolledOn: values.enrolledOn,
          startDate: values.startDate ?? values.enrolledOn,
          endDate: values.endDate,
          feeTotalPaise: values.feeRupees,
          discountPaise: values.discountRupees,
          billingType: values.billingType,
          billingCycle:
            values.billingType === "RECURRING" ? (values.billingCycle ?? null) : null,
          seatNumber,
          assignedMentorUserId: values.assignedMentorUserId ?? null,
          notes: values.notes,
          updatedAt: new Date(),
        })
        .where(eq(enrollments.id, values.id))
        .returning()

      // The fee may have moved, so what is owed has to be re-derived.
      await reconcileSchedule(tx, values.id)

      await audit({
        action: "UPDATE",
        entity: "enrollments",
        entityId: values.id,
        before,
        after,
      })
    })
  } catch (error) {
    if (isUniqueViolation(error)) {
      const message = translateConstraint(error)
      if (message) return { ok: false, error: message, fieldErrors: { seatNumber: message } }
    }
    throw error
  }

  revalidateEverything()
  return { ok: true, data: { id: values.id } }
}

export async function changeEnrollmentStatus(input: unknown): Promise<ActionResult> {
  const user = await requireUser()

  const parsed = enrollmentStatusSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Unknown status." }

  const { id, status } = parsed.data

  const before = await db.query.enrollments.findFirst({
    where: and(eq(enrollments.id, id), isNull(enrollments.deletedAt)),
  })
  if (!before) return { ok: false, error: "That enrollment no longer exists." }

  await mutate(user, async ({ tx, audit }) => {
    const [after] = await tx
      .update(enrollments)
      .set({ status, updatedAt: new Date() })
      .where(eq(enrollments.id, id))
      .returning()

    // A dropped membership stops accruing cycles; a reactivated one resumes.
    await reconcileSchedule(tx, id)

    await audit({
      action: "STATUS_CHANGED",
      entity: "enrollments",
      entityId: id,
      before,
      after,
    })
  })

  revalidateEverything()
  return { ok: true, data: undefined }
}

/**
 * Soft-delete an enrollment AND its payments.
 *
 * The payments must go with it. A payment is money received *for* this
 * enrollment; leaving it live when the enrollment is gone produces a row that
 * still appears on the payments list and still counts toward "collected this
 * month", attached to a record that no longer exists. That is exactly the
 * mismatch that made deletions look like they had not taken effect.
 *
 * Nothing is destroyed: both rows keep their data and their receipt numbers,
 * the audit log records the cascade, and clearing `deleted_at` restores them.
 */
export async function deleteEnrollment(id: string): Promise<ActionResult> {
  const user = await requireUser()

  const before = await db.query.enrollments.findFirst({
    where: and(eq(enrollments.id, id), isNull(enrollments.deletedAt)),
  })
  if (!before) return { ok: false, error: "That enrollment no longer exists." }

  await mutate(user, async ({ tx, audit }) => {
    const deletedAt = new Date()

    const voided = await tx
      .update(payments)
      .set({ deletedAt })
      .where(and(eq(payments.enrollmentId, id), isNull(payments.deletedAt)))
      .returning({ id: payments.id, receiptNo: payments.receiptNo })

    for (const payment of voided) {
      await audit({
        action: "PAYMENT_VOIDED",
        entity: "payments",
        entityId: payment.id,
        after: { reason: "Enrollment deleted", receiptNo: payment.receiptNo },
      })
    }

    const [after] = await tx
      .update(enrollments)
      .set({ deletedAt, updatedAt: new Date() })
      .where(eq(enrollments.id, id))
      .returning()

    await audit({
      action: "DELETE",
      entity: "enrollments",
      entityId: id,
      before,
      after: { ...after, cascadedPayments: voided.length },
    })
  })

  revalidateEverything()
  return { ok: true, data: undefined }
}
