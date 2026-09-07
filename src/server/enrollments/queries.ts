import { and, asc, count, desc, eq, isNull, sql } from "drizzle-orm"

import { db } from "@/db"
import { enrollmentBalances } from "@/db/views"
import { batches, contacts, enrollments, paymentSchedule, programs } from "@/db/schema"

/** An enrollment row joined to the balances view — never a stored balance. */
const enrollmentListSelect = {
  id: enrollments.id,
  status: enrollments.status,
  enrolledOn: enrollments.enrolledOn,
  startDate: enrollments.startDate,
  endDate: enrollments.endDate,
  feeTotalPaise: enrollments.feeTotalPaise,
  discountPaise: enrollments.discountPaise,
  billingType: enrollments.billingType,
  billingCycle: enrollments.billingCycle,
  seatNumber: enrollments.seatNumber,
  contactId: contacts.id,
  contactName: contacts.fullName,
  contactPhone: contacts.phoneE164,
  programId: programs.id,
  programName: programs.name,
  programType: programs.type,
  deliveryMode: programs.deliveryMode,
  batchId: batches.id,
  batchName: batches.name,
  netPayablePaise: enrollmentBalances.netPayablePaise,
  totalPaidPaise: enrollmentBalances.totalPaidPaise,
  balanceDuePaise: enrollmentBalances.balanceDuePaise,
  isOverdue: enrollmentBalances.isOverdue,
  daysOverdue: enrollmentBalances.daysOverdue,
  nextDueDate: enrollmentBalances.nextDueDate,
  nextDueAmountPaise: enrollmentBalances.nextDueAmountPaise,
}

export type EnrollmentListRow = {
  [K in keyof typeof enrollmentListSelect]: unknown
}

export async function listEnrollments(params: {
  page?: number
  perPage?: number
  programId?: string
  status?: string
  contactId?: string
  overdueOnly?: boolean
  /**
   * A batch id, or the literal "none" for enrollments with no batch at all.
   * "none" is a real answer to "which batch is this student in", so it needs
   * to be selectable rather than indistinguishable from "no filter".
   */
  batchId?: string
}) {
  const {
    page = 1,
    perPage = 25,
    programId,
    status,
    contactId,
    overdueOnly,
    batchId,
  } = params

  // The contact guard matters: joining contacts without it left a deleted
  // student's enrollments showing in Records under their name.
  const filters = [isNull(enrollments.deletedAt), isNull(contacts.deletedAt)]
  if (programId) filters.push(eq(enrollments.programId, programId))
  if (status) filters.push(sql`${enrollments.status} = ${status}`)
  if (contactId) filters.push(eq(enrollments.contactId, contactId))
  if (overdueOnly) filters.push(sql`${enrollmentBalances.isOverdue} = true`)
  if (batchId === "none") filters.push(isNull(enrollments.batchId))
  else if (batchId) filters.push(eq(enrollments.batchId, batchId))

  const where = and(...filters)

  const [rows, [totalRow]] = await Promise.all([
    db
      .select(enrollmentListSelect)
      .from(enrollments)
      .innerJoin(contacts, eq(contacts.id, enrollments.contactId))
      .innerJoin(programs, eq(programs.id, enrollments.programId))
      .leftJoin(batches, eq(batches.id, enrollments.batchId))
      .innerJoin(enrollmentBalances, eq(enrollmentBalances.enrollmentId, enrollments.id))
      .where(where)
      .orderBy(
        overdueOnly ? desc(enrollmentBalances.daysOverdue) : desc(enrollments.enrolledOn)
      )
      .limit(perPage)
      .offset((page - 1) * perPage),

    // The count MUST carry the same joins as the rows query: the shared
    // `where` references contacts and programs, and Postgres rejects a
    // predicate naming a table that is not in the FROM clause.
    db
      .select({ value: count() })
      .from(enrollments)
      .innerJoin(contacts, eq(contacts.id, enrollments.contactId))
      .innerJoin(programs, eq(programs.id, enrollments.programId))
      .innerJoin(enrollmentBalances, eq(enrollmentBalances.enrollmentId, enrollments.id))
      .where(where),
  ])

  return { rows, total: totalRow?.value ?? 0 }
}

export async function getEnrollment(id: string) {
  const [row] = await db
    .select({
      ...enrollmentListSelect,
      notes: enrollments.notes,
      feeTotal: enrollments.feeTotalPaise,
      programCode: programs.code,
      contactEmail: contacts.email,
      batchVenue: batches.venueName,
      batchMeetingLink: batches.meetingLink,
      batchSeatCapacity: batches.seatCapacity,
    })
    .from(enrollments)
    .innerJoin(contacts, eq(contacts.id, enrollments.contactId))
    .innerJoin(programs, eq(programs.id, enrollments.programId))
    .leftJoin(batches, eq(batches.id, enrollments.batchId))
    .innerJoin(enrollmentBalances, eq(enrollmentBalances.enrollmentId, enrollments.id))
    .where(
      and(
        eq(enrollments.id, id),
        isNull(enrollments.deletedAt),
        isNull(contacts.deletedAt)
      )
    )
    .limit(1)

  return row ?? null
}

export async function getEnrollmentRaw(id: string) {
  const [row] = await db
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.id, id), isNull(enrollments.deletedAt)))
    .limit(1)
  return row ?? null
}

export async function listSchedule(enrollmentId: string) {
  return db
    .select()
    .from(paymentSchedule)
    .where(eq(paymentSchedule.enrollmentId, enrollmentId))
    .orderBy(asc(paymentSchedule.dueDate), asc(paymentSchedule.seq))
}

/** Enrollments for a contact, for the contact detail page. */
export async function listEnrollmentsForContact(contactId: string) {
  return db
    .select(enrollmentListSelect)
    .from(enrollments)
    .innerJoin(contacts, eq(contacts.id, enrollments.contactId))
    .innerJoin(programs, eq(programs.id, enrollments.programId))
    .leftJoin(batches, eq(batches.id, enrollments.batchId))
    .innerJoin(enrollmentBalances, eq(enrollmentBalances.enrollmentId, enrollments.id))
    .where(
      and(
        eq(enrollments.contactId, contactId),
        isNull(enrollments.deletedAt),
        isNull(contacts.deletedAt)
      )
    )
    .orderBy(desc(enrollments.enrolledOn))
}

/** Live enrollments in a batch — the roster an attendance register is built from. */
export async function listBatchRoster(batchId: string) {
  return db
    .select({
      enrollmentId: enrollments.id,
      contactId: contacts.id,
      contactName: contacts.fullName,
      contactPhone: contacts.phoneE164,
      seatNumber: enrollments.seatNumber,
      status: enrollments.status,
    })
    .from(enrollments)
    .innerJoin(contacts, eq(contacts.id, enrollments.contactId))
    .where(
      and(
        eq(enrollments.batchId, batchId),
        isNull(enrollments.deletedAt),
        isNull(contacts.deletedAt),
        sql`${enrollments.status} in ('ACTIVE', 'PAUSED')`
      )
    )
    .orderBy(asc(contacts.fullName))
}
