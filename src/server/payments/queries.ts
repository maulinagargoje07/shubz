import { and, count, desc, eq, gte, isNull, lte, sql } from "drizzle-orm"

import { db } from "@/db"
import { batches, contacts, enrollments, payments, programs } from "@/db/schema"
import type { PaymentListParams } from "@/lib/validation/payment"

const paymentSelect = {
  id: payments.id,
  amountPaise: payments.amountPaise,
  paidOn: payments.paidOn,
  method: payments.method,
  referenceNo: payments.referenceNo,
  receiptNo: payments.receiptNo,
  notes: payments.notes,
  createdAt: payments.createdAt,
  enrollmentId: enrollments.id,
  contactId: contacts.id,
  contactName: contacts.fullName,
  contactPhone: contacts.phoneE164,
  programId: programs.id,
  programName: programs.name,
  programType: programs.type,
  deliveryMode: programs.deliveryMode,
  batchName: batches.name,
}

export async function listPayments(params: PaymentListParams) {
  const { from, to, method, programId, page, perPage } = params

  const filters = [isNull(payments.deletedAt)]
  if (from) filters.push(gte(payments.paidOn, from))
  if (to) filters.push(lte(payments.paidOn, to))
  if (method) filters.push(eq(payments.method, method))
  if (programId) filters.push(eq(programs.id, programId))

  const where = and(...filters)

  const [rows, [totalRow], [sumRow]] = await Promise.all([
    db
      .select(paymentSelect)
      .from(payments)
      .innerJoin(enrollments, eq(enrollments.id, payments.enrollmentId))
      .innerJoin(contacts, eq(contacts.id, enrollments.contactId))
      .innerJoin(programs, eq(programs.id, enrollments.programId))
      .leftJoin(batches, eq(batches.id, enrollments.batchId))
      .where(where)
      .orderBy(desc(payments.paidOn), desc(payments.createdAt))
      .limit(perPage)
      .offset((page - 1) * perPage),

    db
      .select({ value: count() })
      .from(payments)
      .innerJoin(enrollments, eq(enrollments.id, payments.enrollmentId))
      .innerJoin(programs, eq(programs.id, enrollments.programId))
      .where(where),

    db
      .select({ value: sql<number>`coalesce(sum(${payments.amountPaise}), 0)::bigint` })
      .from(payments)
      .innerJoin(enrollments, eq(enrollments.id, payments.enrollmentId))
      .innerJoin(programs, eq(programs.id, enrollments.programId))
      .where(where),
  ])

  return {
    rows,
    total: totalRow?.value ?? 0,
    sumPaise: Number(sumRow?.value ?? 0),
  }
}

export async function listPaymentsForEnrollment(enrollmentId: string) {
  return db
    .select()
    .from(payments)
    .where(and(eq(payments.enrollmentId, enrollmentId), isNull(payments.deletedAt)))
    .orderBy(desc(payments.paidOn), desc(payments.createdAt))
}

export async function listPaymentsForContact(contactId: string) {
  return db
    .select(paymentSelect)
    .from(payments)
    .innerJoin(enrollments, eq(enrollments.id, payments.enrollmentId))
    .innerJoin(contacts, eq(contacts.id, enrollments.contactId))
    .innerJoin(programs, eq(programs.id, enrollments.programId))
    .leftJoin(batches, eq(batches.id, enrollments.batchId))
    .where(and(eq(enrollments.contactId, contactId), isNull(payments.deletedAt)))
    .orderBy(desc(payments.paidOn))
}

/** Everything a printable receipt needs, in one query. */
export async function getReceipt(paymentId: string) {
  const [row] = await db
    .select({
      ...paymentSelect,
      programCode: programs.code,
      contactEmail: contacts.email,
      contactCity: contacts.city,
      batchCode: batches.code,
      deletedAt: payments.deletedAt,
    })
    .from(payments)
    .innerJoin(enrollments, eq(enrollments.id, payments.enrollmentId))
    .innerJoin(contacts, eq(contacts.id, enrollments.contactId))
    .innerJoin(programs, eq(programs.id, enrollments.programId))
    .leftJoin(batches, eq(batches.id, enrollments.batchId))
    .where(eq(payments.id, paymentId))
    .limit(1)

  return row ?? null
}
