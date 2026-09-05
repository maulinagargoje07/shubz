/**
 * Ledger mechanics shared by enrollments and payments.
 *
 * Two operations live here because both must run inside the SAME transaction
 * as the change that triggered them:
 *
 *   1. `reconcileSchedule` — replay all live payments against the schedule,
 *      oldest due date first, and rewrite each row's status plus the
 *      enrollment's next_due_date. Derived, never incremented: correcting a
 *      payment re-runs this and lands on the right answer, where adjusting a
 *      stored counter would drift.
 *
 *   2. `nextReceiptNo` — allocate the next receipt number for the financial
 *      year under an advisory lock, so two people recording payments at the
 *      same moment cannot take the same number.
 */

import { and, eq, isNull, sql } from "drizzle-orm"

import type { DbTx } from "@/db"
import { enrollments, paymentSchedule, payments } from "@/db/schema"
import {
  allocatePayments,
  deriveNextDueDate,
  planTopUpCycles,
  type AllocatableRow,
} from "@/lib/billing"
import { financialYear, todayIST } from "@/lib/fy"
import { newId } from "@/lib/ids"

/**
 * Recompute schedule statuses and next_due_date for one enrollment.
 * Call after ANY change to its payments or schedule.
 */
export async function reconcileSchedule(tx: DbTx, enrollmentId: string): Promise<void> {
  const [enrollment] = await tx
    .select({
      id: enrollments.id,
      billingType: enrollments.billingType,
      billingCycle: enrollments.billingCycle,
      feeTotalPaise: enrollments.feeTotalPaise,
      discountPaise: enrollments.discountPaise,
      startDate: enrollments.startDate,
      endDate: enrollments.endDate,
      enrolledOn: enrollments.enrolledOn,
      status: enrollments.status,
    })
    .from(enrollments)
    .where(eq(enrollments.id, enrollmentId))
    .limit(1)

  if (!enrollment) return

  // Soft-deleted payments do not count toward anything.
  const [{ total }] = await tx
    .select({ total: sql<number>`coalesce(sum(${payments.amountPaise}), 0)::bigint` })
    .from(payments)
    .where(and(eq(payments.enrollmentId, enrollmentId), isNull(payments.deletedAt)))

  const totalPaid = Number(total ?? 0)

  let rows = await tx
    .select({
      id: paymentSchedule.id,
      seq: paymentSchedule.seq,
      dueDate: paymentSchedule.dueDate,
      amountPaise: paymentSchedule.amountPaise,
      status: paymentSchedule.status,
    })
    .from(paymentSchedule)
    .where(eq(paymentSchedule.enrollmentId, enrollmentId))

  /**
   * A live recurring membership keeps upcoming cycles raised, so an
   * open-ended Trading Floor member always has a next due date without
   * anyone remembering to generate one.
   */
  if (
    enrollment.billingType === "RECURRING" &&
    enrollment.billingCycle &&
    (enrollment.status === "ACTIVE" || enrollment.status === "PAUSED")
  ) {
    const perCycle = Math.max(enrollment.feeTotalPaise - enrollment.discountPaise, 0)
    const provisional = allocatePayments(rows as AllocatableRow[], totalPaid)
    const statusById = new Map(provisional.map((a) => [a.id, a.status]))

    const topUp = planTopUpCycles({
      billingCycle: enrollment.billingCycle,
      perCyclePaise: perCycle,
      existing: rows.map((r) => ({
        seq: r.seq,
        dueDate: r.dueDate,
        status: statusById.get(r.id) ?? r.status,
      })),
      endDate: enrollment.endDate,
      startDate: enrollment.startDate ?? enrollment.enrolledOn,
    })

    if (topUp.length > 0) {
      const inserted = await tx
        .insert(paymentSchedule)
        .values(
          topUp.map((row) => ({
            id: newId(),
            enrollmentId,
            seq: row.seq,
            dueDate: row.dueDate,
            amountPaise: row.amountPaise,
            status: "PENDING" as const,
          }))
        )
        .returning({
          id: paymentSchedule.id,
          seq: paymentSchedule.seq,
          dueDate: paymentSchedule.dueDate,
          amountPaise: paymentSchedule.amountPaise,
          status: paymentSchedule.status,
        })

      rows = [...rows, ...inserted]
    }
  }

  const today = todayIST()
  const allocations = allocatePayments(rows as AllocatableRow[], totalPaid, today)

  // Only write rows whose status actually changed.
  const currentById = new Map(rows.map((r) => [r.id, r.status]))
  for (const allocation of allocations) {
    if (currentById.get(allocation.id) === allocation.status) continue
    await tx
      .update(paymentSchedule)
      .set({ status: allocation.status, updatedAt: new Date() })
      .where(eq(paymentSchedule.id, allocation.id))
  }

  const nextDue = deriveNextDueDate(rows as AllocatableRow[], allocations)

  await tx
    .update(enrollments)
    .set({ nextDueDate: nextDue, updatedAt: new Date() })
    .where(eq(enrollments.id, enrollmentId))
}

/**
 * Allocate the next receipt number, e.g. "ST-2026-000042".
 *
 * The advisory lock is transaction-scoped and keyed on the financial year, so
 * concurrent payments serialise on the counter and cannot collide. It releases
 * automatically at commit or rollback.
 */
export async function nextReceiptNo(tx: DbTx, paidOn: string): Promise<string> {
  const fy = financialYear(paidOn)
  const prefix = `ST-${fy}-`

  // Namespace 8471 keeps this lock distinct from any other advisory lock.
  await tx.execute(sql`select pg_advisory_xact_lock(8471, ${fy})`)

  const result = await tx.execute<{ max_seq: number | null }>(sql`
    select max(substring(receipt_no from '\\d+$')::int) as max_seq
    from payments
    where receipt_no like ${`${prefix}%`}
  `)

  const rows = (result as unknown as { rows?: { max_seq: number | null }[] }).rows ?? []
  const maxSeq = Number(rows[0]?.max_seq ?? 0)

  return `${prefix}${String(maxSeq + 1).padStart(6, "0")}`
}
