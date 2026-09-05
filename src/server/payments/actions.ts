"use server"

import { revalidatePath } from "next/cache"
import { and, eq, isNull } from "drizzle-orm"

import { db } from "@/db"
import { enrollments, payments } from "@/db/schema"
import { mutate } from "@/lib/audit"
import { newId } from "@/lib/ids"
import { requireUser } from "@/lib/session"
import { paymentFormSchema, voidPaymentSchema } from "@/lib/validation/payment"
import type { ActionResult } from "@/lib/validation/shared"
import { nextReceiptNo, reconcileSchedule } from "./ledger"

function fieldErrorsOf(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "")
    if (key && !out[key]) out[key] = issue.message
  }
  return out
}

/**
 * Record a payment.
 *
 * Everything happens in ONE transaction: allocate the receipt number under an
 * advisory lock, insert the ledger row, re-derive the schedule statuses and
 * next_due_date, and write the audit entry. If any step fails the receipt
 * number is never consumed, so the financial year's sequence stays contiguous.
 */
export async function recordPayment(
  input: unknown
): Promise<ActionResult<{ id: string; receiptNo: string }>> {
  const user = await requireUser()

  const parsed = paymentFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsOf(parsed.error),
    }
  }

  const values = parsed.data

  const enrollment = await db.query.enrollments.findFirst({
    where: and(eq(enrollments.id, values.enrollmentId), isNull(enrollments.deletedAt)),
  })
  if (!enrollment) return { ok: false, error: "That enrollment no longer exists." }

  const result = await mutate(user, async ({ tx, audit }) => {
    const receiptNo = await nextReceiptNo(tx, values.paidOn)

    const [row] = await tx
      .insert(payments)
      .values({
        id: newId(),
        enrollmentId: values.enrollmentId,
        amountPaise: values.amountRupees,
        paidOn: values.paidOn,
        method: values.method,
        referenceNo: values.referenceNo,
        receiptNo,
        notes: values.notes,
        recordedByUserId: user.id,
      })
      .returning()

    await reconcileSchedule(tx, values.enrollmentId)

    await audit({
      action: "PAYMENT_RECORDED",
      entity: "payments",
      entityId: row.id,
      after: row,
    })

    return { id: row.id, receiptNo }
  })

  revalidatePath("/payments")
  revalidatePath("/fees")
  revalidatePath(`/enrollments/${values.enrollmentId}`)
  revalidatePath(`/contacts/${enrollment.contactId}`)
  return { ok: true, data: result }
}

/**
 * Void a payment.
 *
 * The ledger is append-only, so this soft-deletes rather than erasing: the row
 * and its receipt number stay on file, the reason is recorded, and the balance
 * is re-derived. A wrong payment is corrected by voiding and re-recording,
 * which leaves the whole story visible in the audit log.
 */
export async function voidPayment(input: unknown): Promise<ActionResult> {
  const user = await requireUser()

  const parsed = voidPaymentSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Give a reason for voiding this payment.",
      fieldErrors: fieldErrorsOf(parsed.error),
    }
  }

  const { id, reason } = parsed.data

  const before = await db.query.payments.findFirst({
    where: and(eq(payments.id, id), isNull(payments.deletedAt)),
  })
  if (!before) return { ok: false, error: "That payment is already void." }

  await mutate(user, async ({ tx, audit }) => {
    const [after] = await tx
      .update(payments)
      .set({
        deletedAt: new Date(),
        notes: before.notes ? `${before.notes}\n\nVoided: ${reason}` : `Voided: ${reason}`,
      })
      .where(eq(payments.id, id))
      .returning()

    await reconcileSchedule(tx, before.enrollmentId)

    await audit({
      action: "PAYMENT_VOIDED",
      entity: "payments",
      entityId: id,
      before,
      after,
    })
  })

  revalidatePath("/payments")
  revalidatePath("/fees")
  revalidatePath(`/enrollments/${before.enrollmentId}`)
  return { ok: true, data: undefined }
}
