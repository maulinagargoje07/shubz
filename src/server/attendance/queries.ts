/**
 * Attendance reads, including the percentage shown on a contact.
 *
 * The percentage formula, decided deliberately:
 *
 *   (PRESENT + LATE) / (sessions with status COMPLETED, minus EXCUSED rows)
 *
 * Only sessions that actually happened count, so a batch half-way through does
 * not show everyone at 40%. Cancelled and future sessions are excluded, an
 * excused absence is removed from the denominator rather than held against the
 * student, and a completed session nobody marked counts as an absence — which
 * is the honest reading, since the register was not taken.
 */

import { and, asc, eq, isNull, sql } from "drizzle-orm"

import { db } from "@/db"
import { attendance, batches, classSessions, contacts, enrollments, programs } from "@/db/schema"

export async function getSessionRegister(sessionId: string) {
  const rows = await db
    .select({
      enrollmentId: enrollments.id,
      contactId: contacts.id,
      contactName: contacts.fullName,
      contactPhone: contacts.phoneE164,
      seatNumber: enrollments.seatNumber,
      attendanceId: attendance.id,
      status: attendance.status,
      source: attendance.source,
    })
    .from(classSessions)
    .innerJoin(batches, eq(batches.id, classSessions.batchId))
    .innerJoin(
      enrollments,
      and(
        eq(enrollments.batchId, batches.id),
        isNull(enrollments.deletedAt),
        sql`${enrollments.status} in ('ACTIVE', 'PAUSED')`
      )
    )
    .innerJoin(contacts, eq(contacts.id, enrollments.contactId))
    .leftJoin(
      attendance,
      and(
        eq(attendance.sessionId, classSessions.id),
        eq(attendance.enrollmentId, enrollments.id)
      )
    )
    .where(eq(classSessions.id, sessionId))
    .orderBy(asc(enrollments.seatNumber), asc(contacts.fullName))

  return rows
}

/** Attendance percentage for one contact, across all their enrollments. */
export async function contactAttendanceRate(contactId: string): Promise<{
  attended: number
  eligible: number
  percent: number | null
}> {
  const [row] = await db
    .select({
      // Sessions that actually happened, in batches this contact is enrolled in.
      eligible: sql<number>`count(*) filter (
        where ${classSessions.status} = 'COMPLETED'
          and coalesce(${attendance.status}::text, '') <> 'EXCUSED'
      )::int`,
      attended: sql<number>`count(*) filter (
        where ${classSessions.status} = 'COMPLETED'
          and ${attendance.status} in ('PRESENT', 'LATE')
      )::int`,
    })
    .from(enrollments)
    .innerJoin(classSessions, eq(classSessions.batchId, enrollments.batchId))
    .leftJoin(
      attendance,
      and(
        eq(attendance.sessionId, classSessions.id),
        eq(attendance.enrollmentId, enrollments.id)
      )
    )
    .where(and(eq(enrollments.contactId, contactId), isNull(enrollments.deletedAt)))

  const eligible = Number(row?.eligible ?? 0)
  const attended = Number(row?.attended ?? 0)

  return {
    attended,
    eligible,
    percent: eligible === 0 ? null : Math.round((attended / eligible) * 100),
  }
}

/** Per-session attendance rows for the contact detail page. */
export async function listAttendanceForContact(contactId: string, limit = 50) {
  return db
    .select({
      id: attendance.id,
      status: attendance.status,
      markedAt: attendance.markedAt,
      source: attendance.source,
      sessionId: classSessions.id,
      sessionTitle: classSessions.title,
      scheduledAt: classSessions.scheduledAt,
      batchName: batches.name,
      programName: programs.name,
    })
    .from(attendance)
    .innerJoin(enrollments, eq(enrollments.id, attendance.enrollmentId))
    .innerJoin(classSessions, eq(classSessions.id, attendance.sessionId))
    .innerJoin(batches, eq(batches.id, classSessions.batchId))
    .innerJoin(programs, eq(programs.id, batches.programId))
    .where(and(eq(enrollments.contactId, contactId), isNull(enrollments.deletedAt)))
    .orderBy(sql`${classSessions.scheduledAt} desc`)
    .limit(limit)
}
