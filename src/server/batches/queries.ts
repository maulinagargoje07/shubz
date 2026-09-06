import { and, asc, eq, isNull, sql } from "drizzle-orm"

import { db } from "@/db"
import { batches, enrollments, programs } from "@/db/schema"

export async function listBatchesForProgram(programId: string) {
  return db
    .select({
      id: batches.id,
      name: batches.name,
      code: batches.code,
      startDate: batches.startDate,
      endDate: batches.endDate,
      timingText: batches.timingText,
      capacity: batches.capacity,
      seatCapacity: batches.seatCapacity,
      meetingLink: batches.meetingLink,
      venueName: batches.venueName,
      status: batches.status,
      // Participants is a live count, so a dropped student stops occupying a seat.
      // Explicit aliases — see the note in programs/queries.ts.
      participantCount: sql<number>`(
        select count(*)::int
        from enrollments e
        join contacts c on c.id = e.contact_id and c.deleted_at is null
        where e.batch_id = batches.id
          and e.deleted_at is null
          and e.status in ('ACTIVE', 'PAUSED')
      )`,
      sessionCount: sql<number>`(
        select count(*)::int
        from sessions s
        where s.batch_id = batches.id
      )`,
    })
    .from(batches)
    .where(eq(batches.programId, programId))
    .orderBy(asc(batches.startDate), asc(batches.name))
}

/** A batch plus the parent program's delivery mode, which drives its form. */
export async function getBatchWithProgram(id: string) {
  const [row] = await db
    .select({
      batch: batches,
      program: {
        id: programs.id,
        name: programs.name,
        type: programs.type,
        deliveryMode: programs.deliveryMode,
        defaultFeePaise: programs.defaultFeePaise,
        defaultBillingType: programs.defaultBillingType,
        defaultBillingCycle: programs.defaultBillingCycle,
      },
    })
    .from(batches)
    .innerJoin(programs, eq(programs.id, batches.programId))
    .where(eq(batches.id, id))
    .limit(1)

  return row ?? null
}

export async function getBatchByCode(code: string, excludeId?: string) {
  const [row] = await db
    .select({ id: batches.id, name: batches.name })
    .from(batches)
    .where(eq(batches.code, code))
    .limit(1)

  if (!row) return null
  if (excludeId && row.id === excludeId) return null
  return row
}

/** Batches selectable when enrolling into a given program. */
export async function listBatchesForPicker(programId: string) {
  return db
    .select({
      id: batches.id,
      name: batches.name,
      code: batches.code,
      status: batches.status,
      seatCapacity: batches.seatCapacity,
      startDate: batches.startDate,
    })
    .from(batches)
    .where(eq(batches.programId, programId))
    .orderBy(asc(batches.startDate), asc(batches.name))
}

/** Seats already taken in a batch, so the form can warn before the constraint does. */
export async function listTakenSeats(batchId: string, excludeEnrollmentId?: string) {
  const rows = await db
    .select({ seatNumber: enrollments.seatNumber, id: enrollments.id })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.batchId, batchId),
        isNull(enrollments.deletedAt),
        sql`${enrollments.seatNumber} is not null`
      )
    )

  return rows
    .filter((r) => r.id !== excludeEnrollmentId)
    .map((r) => r.seatNumber!)
    .filter(Boolean)
}
