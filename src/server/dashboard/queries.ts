import { and, count, eq, isNull, sql } from "drizzle-orm"

import { db } from "@/db"
import { batches, contacts, enrollments, programs } from "@/db/schema"

export async function totalContacts(): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(contacts)
    .where(isNull(contacts.deletedAt))
  return row?.value ?? 0
}

/** Distinct people with at least one live ACTIVE enrollment. */
export async function activeStudentCount(): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`count(distinct ${enrollments.contactId})::int` })
    .from(enrollments)
    .innerJoin(contacts, eq(contacts.id, enrollments.contactId))
    .where(
      and(
        isNull(enrollments.deletedAt),
        isNull(contacts.deletedAt),
        eq(enrollments.status, "ACTIVE")
      )
    )
  return Number(row?.value ?? 0)
}

export async function activeBatchCount(): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(batches)
    .where(sql`${batches.status} in ('OPEN', 'RUNNING')`)
  return row?.value ?? 0
}

/**
 * Active students split by program TYPE and MODE — the query that justifies
 * keeping those as two independent columns. It answers "how many people attend
 * offline" and "how many are on mentorship" from the same rows, with no string
 * parsing.
 */
export async function activeStudentsByProgramKind() {
  return db
    .select({
      type: programs.type,
      deliveryMode: programs.deliveryMode,
      studentCount: sql<number>`count(distinct ${enrollments.contactId})::int`,
      enrollmentCount: sql<number>`count(*)::int`,
    })
    .from(enrollments)
    .innerJoin(programs, eq(programs.id, enrollments.programId))
    .innerJoin(contacts, eq(contacts.id, enrollments.contactId))
    .where(
      and(
        isNull(enrollments.deletedAt),
        isNull(contacts.deletedAt),
        eq(enrollments.status, "ACTIVE")
      )
    )
    .groupBy(programs.type, programs.deliveryMode)
    .orderBy(sql`count(distinct ${enrollments.contactId}) desc`)
}

export async function contactsByStage() {
  return db
    .select({
      stage: contacts.lifecycleStage,
      value: sql<number>`count(*)::int`,
    })
    .from(contacts)
    .where(isNull(contacts.deletedAt))
    .groupBy(contacts.lifecycleStage)
}
