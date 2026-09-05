/**
 * Fee reporting. Every figure here reads `enrollment_balances` — no balance is
 * ever stored, so these numbers cannot drift from the ledger.
 */

import { and, desc, eq, gte, isNull, lt, lte, sql } from "drizzle-orm"

import { db } from "@/db"
import { enrollmentBalances } from "@/db/views"
import { batches, contacts, enrollments, payments, programs } from "@/db/schema"
import { monthRangeIST, todayIST } from "@/lib/fy"

/** Total collected in a calendar month, in IST. */
export async function collectedInMonth(year: number, month: number): Promise<number> {
  const { start, end } = monthRangeIST(year, month)
  const startDate = start.toISOString().slice(0, 10)
  const endDate = end.toISOString().slice(0, 10)

  const [row] = await db
    .select({ value: sql<number>`coalesce(sum(${payments.amountPaise}), 0)::bigint` })
    .from(payments)
    .where(
      and(isNull(payments.deletedAt), gte(payments.paidOn, startDate), lt(payments.paidOn, endDate))
    )

  return Number(row?.value ?? 0)
}

export async function collectedThisMonth(): Promise<number> {
  const today = todayIST()
  const [year, month] = today.split("-").map(Number)
  return collectedInMonth(year, month)
}

/**
 * Total still owed across live enrollments.
 * Negative balances (overpayments) are floored at zero so one prepaid student
 * cannot mask another's arrears.
 */
export async function totalOutstanding(): Promise<number> {
  const [row] = await db
    .select({
      value: sql<number>`coalesce(sum(greatest(${enrollmentBalances.balanceDuePaise}, 0)), 0)::bigint`,
    })
    .from(enrollmentBalances)
    .innerJoin(enrollments, eq(enrollments.id, enrollmentBalances.enrollmentId))
    .where(and(isNull(enrollments.deletedAt), sql`${enrollments.status} <> 'CANCELLED'`))

  return Number(row?.value ?? 0)
}

export async function overdueCount(): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(enrollmentBalances)
    .innerJoin(enrollments, eq(enrollments.id, enrollmentBalances.enrollmentId))
    .where(
      and(
        isNull(enrollments.deletedAt),
        sql`${enrollments.status} <> 'CANCELLED'`,
        eq(enrollmentBalances.isOverdue, true)
      )
    )

  return Number(row?.value ?? 0)
}

/** The overdue list, worst first. */
export async function listOverdue(limit = 100) {
  return db
    .select({
      enrollmentId: enrollments.id,
      contactId: contacts.id,
      contactName: contacts.fullName,
      contactPhone: contacts.phoneE164,
      programId: programs.id,
      programName: programs.name,
      programType: programs.type,
      deliveryMode: programs.deliveryMode,
      batchName: batches.name,
      status: enrollments.status,
      balanceDuePaise: enrollmentBalances.balanceDuePaise,
      daysOverdue: enrollmentBalances.daysOverdue,
      nextDueDate: enrollmentBalances.nextDueDate,
      nextDueAmountPaise: enrollmentBalances.nextDueAmountPaise,
    })
    .from(enrollmentBalances)
    .innerJoin(enrollments, eq(enrollments.id, enrollmentBalances.enrollmentId))
    .innerJoin(contacts, eq(contacts.id, enrollments.contactId))
    .innerJoin(programs, eq(programs.id, enrollments.programId))
    .leftJoin(batches, eq(batches.id, enrollments.batchId))
    .where(
      and(
        isNull(enrollments.deletedAt),
        sql`${enrollments.status} <> 'CANCELLED'`,
        eq(enrollmentBalances.isOverdue, true)
      )
    )
    .orderBy(desc(enrollmentBalances.daysOverdue))
    .limit(limit)
}

/** Collection split by program, for the current month and all time. */
export async function collectionByProgram() {
  const today = todayIST()
  const [year, month] = today.split("-").map(Number)
  const { start, end } = monthRangeIST(year, month)
  const startDate = start.toISOString().slice(0, 10)
  const endDate = end.toISOString().slice(0, 10)

  return db
    .select({
      programId: programs.id,
      programName: programs.name,
      programType: programs.type,
      deliveryMode: programs.deliveryMode,
      collectedThisMonthPaise: sql<number>`coalesce(sum(
        case when ${payments.paidOn} >= ${startDate} and ${payments.paidOn} < ${endDate}
        then ${payments.amountPaise} else 0 end
      ), 0)::bigint`,
      collectedAllTimePaise: sql<number>`coalesce(sum(${payments.amountPaise}), 0)::bigint`,
      paymentCount: sql<number>`count(${payments.id})::int`,
    })
    .from(programs)
    .leftJoin(enrollments, and(eq(enrollments.programId, programs.id), isNull(enrollments.deletedAt)))
    .leftJoin(payments, and(eq(payments.enrollmentId, enrollments.id), isNull(payments.deletedAt)))
    .groupBy(programs.id, programs.name, programs.type, programs.deliveryMode)
    .orderBy(desc(sql`coalesce(sum(${payments.amountPaise}), 0)`))
}

/** Outstanding split by program, for the fees page. */
export async function outstandingByProgram() {
  return db
    .select({
      programId: programs.id,
      programName: programs.name,
      programType: programs.type,
      deliveryMode: programs.deliveryMode,
      outstandingPaise: sql<number>`coalesce(sum(greatest(${enrollmentBalances.balanceDuePaise}, 0)), 0)::bigint`,
      overdueCount: sql<number>`count(*) filter (where ${enrollmentBalances.isOverdue})::int`,
    })
    .from(enrollmentBalances)
    .innerJoin(enrollments, eq(enrollments.id, enrollmentBalances.enrollmentId))
    .innerJoin(programs, eq(programs.id, enrollments.programId))
    .where(and(isNull(enrollments.deletedAt), sql`${enrollments.status} <> 'CANCELLED'`))
    .groupBy(programs.id, programs.name, programs.type, programs.deliveryMode)
    .orderBy(desc(sql`coalesce(sum(greatest(${enrollmentBalances.balanceDuePaise}, 0)), 0)`))
}
