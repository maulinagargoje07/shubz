import { and, asc, eq, isNull, sql } from "drizzle-orm"

import { db } from "@/db"
import {
  attendance,
  batches,
  classSessions,
  contacts,
  enrollments,
  programs,
} from "@/db/schema"

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


/**
 * A batch with this name already in this program?
 *
 * Matching mirrors the `batches_program_name_uq` index — case- and
 * whitespace-insensitive — so the friendly error and the database agree on
 * what counts as a duplicate.
 */
export async function getBatchByName(
  programId: string,
  name: string,
  excludeId?: string
) {
  const [row] = await db
    .select({ id: batches.id, name: batches.name, code: batches.code })
    .from(batches)
    .where(
      and(
        eq(batches.programId, programId),
        sql`lower(trim(${batches.name})) = ${name.trim().toLowerCase()}`
      )
    )
    .limit(1)

  if (!row) return null
  if (excludeId && row.id === excludeId) return null
  return row
}


/**
 * Every batch, for the top-level batch list.
 *
 * Batches were previously reachable only by going Programs -> a program -> a
 * batch, which meant you had to already know which program a batch belonged to
 * in order to find it. This is the flat view.
 *
 * The attendance columns answer the question the list is actually for: how far
 * through is this batch, and are its registers being kept.
 */
export async function listAllBatches(params: {
  programId?: string
  status?: string
} = {}) {
  const filters = []
  if (params.programId) filters.push(eq(batches.programId, params.programId))
  if (params.status) filters.push(sql`${batches.status} = ${params.status}`)

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
      venueName: batches.venueName,
      meetingLink: batches.meetingLink,
      status: batches.status,
      programId: programs.id,
      programName: programs.name,
      programType: programs.type,
      deliveryMode: programs.deliveryMode,

      participantCount: sql<number>`(
        select count(*)::int
        from enrollments e
        join contacts c on c.id = e.contact_id and c.deleted_at is null
        where e.batch_id = batches.id
          and e.deleted_at is null
          and e.status in ('ACTIVE', 'PAUSED')
      )`,
      sessionCount: sql<number>`(
        select count(*)::int from sessions s where s.batch_id = batches.id
      )`,
      // "Held" mirrors the attendance rule: it has happened, or was marked so,
      // and was not cancelled.
      heldCount: sql<number>`(
        select count(*)::int from sessions s
        where s.batch_id = batches.id
          and s.status <> 'CANCELLED'
          and (s.status = 'COMPLETED' or s.scheduled_at <= now())
      )`,
      markedCount: sql<number>`(
        select count(*)::int from sessions s
        where s.batch_id = batches.id
          and s.status <> 'CANCELLED'
          and (s.status = 'COMPLETED' or s.scheduled_at <= now())
          and exists (select 1 from attendance a where a.session_id = s.id)
      )`,
      // Typed as a string: a raw subquery is not mapped by the driver, so a
      // timestamptz arrives as text. Claiming Date here type-checked fine and
      // then failed on the first `.toISOString()`.
      nextSessionAt: sql<string | null>`(
        select min(s.scheduled_at) from sessions s
        where s.batch_id = batches.id
          and s.status not in ('CANCELLED', 'COMPLETED')
          and s.scheduled_at > now()
      )`,
    })
    .from(batches)
    .innerJoin(programs, eq(programs.id, batches.programId))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(asc(programs.name), asc(batches.name))
}

/**
 * The attendance grid for one batch: every student against every session held.
 *
 * Attendance could only be seen one session at a time, which answers "who came
 * today" but never "who keeps missing classes" — the question that actually
 * needs acting on. This returns both axes so the page can show the whole
 * picture, including which registers have not been taken yet.
 */
export async function batchAttendanceOverview(batchId: string) {
  const sessionRows = await db
    .select({
      id: classSessions.id,
      seq: classSessions.seq,
      title: classSessions.title,
      scheduledAt: classSessions.scheduledAt,
      status: classSessions.status,
      markedCount: sql<number>`(
        select count(*)::int from attendance a where a.session_id = sessions.id
      )`,
    })
    .from(classSessions)
    .where(eq(classSessions.batchId, batchId))
    .orderBy(asc(classSessions.scheduledAt), asc(classSessions.seq))

  const now = Date.now()
  const sessions = sessionRows.map((row) => ({
    ...row,
    held:
      row.status !== "CANCELLED" &&
      (row.status === "COMPLETED" || row.scheduledAt.getTime() <= now),
  }))

  const rosterRows = await db
    .select({
      enrollmentId: enrollments.id,
      contactId: contacts.id,
      name: contacts.fullName,
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

  const marks = await db
    .select({
      sessionId: attendance.sessionId,
      enrollmentId: attendance.enrollmentId,
      status: attendance.status,
    })
    .from(attendance)
    .innerJoin(classSessions, eq(classSessions.id, attendance.sessionId))
    .where(eq(classSessions.batchId, batchId))

  const byEnrollment = new Map<string, Map<string, string>>()
  for (const mark of marks) {
    const row = byEnrollment.get(mark.enrollmentId) ?? new Map()
    row.set(mark.sessionId, mark.status)
    byEnrollment.set(mark.enrollmentId, row)
  }

  const heldSessions = sessions.filter((s) => s.held)

  const students = rosterRows.map((student) => {
    const row = byEnrollment.get(student.enrollmentId) ?? new Map<string, string>()

    // Same formula as the contact page: excused absences leave the
    // denominator, an unmarked held session counts against the student.
    let attended = 0
    let eligible = 0
    for (const session of heldSessions) {
      const mark = row.get(session.id)
      if (mark === "EXCUSED") continue
      eligible++
      if (mark === "PRESENT" || mark === "LATE") attended++
    }

    return {
      ...student,
      marks: Object.fromEntries(row) as Record<string, string>,
      attended,
      eligible,
      percent: eligible === 0 ? null : Math.round((attended / eligible) * 100),
    }
  })

  return { sessions, students, heldCount: heldSessions.length }
}
