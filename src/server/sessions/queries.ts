import { and, asc, count, eq, gte, lte, sql } from "drizzle-orm"

import { db } from "@/db"
import { attendance, batches, classSessions, enrollments, programs } from "@/db/schema"

export async function listSessionsForBatch(batchId: string) {
  return db
    .select({
      id: classSessions.id,
      seq: classSessions.seq,
      title: classSessions.title,
      scheduledAt: classSessions.scheduledAt,
      durationMinutes: classSessions.durationMinutes,
      meetingLink: classSessions.meetingLink,
      roomOrDesk: classSessions.roomOrDesk,
      recordingLink: classSessions.recordingLink,
      status: classSessions.status,
      markedCount: sql<number>`(
        select count(*)::int from ${attendance}
        where ${attendance.sessionId} = ${classSessions.id}
      )`,
    })
    .from(classSessions)
    .where(eq(classSessions.batchId, batchId))
    .orderBy(asc(classSessions.scheduledAt), asc(classSessions.seq))
}

export async function getSessionWithContext(id: string) {
  const [row] = await db
    .select({
      session: classSessions,
      batch: {
        id: batches.id,
        name: batches.name,
        programId: batches.programId,
        venueName: batches.venueName,
        meetingLink: batches.meetingLink,
      },
      program: {
        id: programs.id,
        name: programs.name,
        type: programs.type,
        deliveryMode: programs.deliveryMode,
      },
    })
    .from(classSessions)
    .innerJoin(batches, eq(batches.id, classSessions.batchId))
    .innerJoin(programs, eq(programs.id, batches.programId))
    .where(eq(classSessions.id, id))
    .limit(1)

  return row ?? null
}

/** Next sequence number for a batch, so the form pre-fills sensibly. */
export async function nextSessionSeq(batchId: string): Promise<number> {
  const [row] = await db
    .select({ maxSeq: sql<number | null>`max(${classSessions.seq})` })
    .from(classSessions)
    .where(eq(classSessions.batchId, batchId))

  return (row?.maxSeq ?? 0) + 1
}

/** Sessions across all batches, for the global sessions list and dashboard. */
export async function listUpcomingSessions(days = 7) {
  const now = new Date()
  const until = new Date(now.getTime() + days * 86_400_000)

  return db
    .select({
      id: classSessions.id,
      title: classSessions.title,
      scheduledAt: classSessions.scheduledAt,
      status: classSessions.status,
      batchId: batches.id,
      batchName: batches.name,
      programId: programs.id,
      programName: programs.name,
      programType: programs.type,
      deliveryMode: programs.deliveryMode,
      venueName: batches.venueName,
    })
    .from(classSessions)
    .innerJoin(batches, eq(batches.id, classSessions.batchId))
    .innerJoin(programs, eq(programs.id, batches.programId))
    .where(
      and(
        gte(classSessions.scheduledAt, now),
        lte(classSessions.scheduledAt, until),
        sql`${classSessions.status} <> 'CANCELLED'`
      )
    )
    .orderBy(asc(classSessions.scheduledAt))
}

export async function countUpcomingSessions(days = 7): Promise<number> {
  const now = new Date()
  const until = new Date(now.getTime() + days * 86_400_000)

  const [row] = await db
    .select({ value: count() })
    .from(classSessions)
    .where(
      and(
        gte(classSessions.scheduledAt, now),
        lte(classSessions.scheduledAt, until),
        sql`${classSessions.status} <> 'CANCELLED'`
      )
    )

  return row?.value ?? 0
}

/** Recent and upcoming sessions for the global list page. */
export async function listAllSessions(limit = 100) {
  return db
    .select({
      id: classSessions.id,
      title: classSessions.title,
      seq: classSessions.seq,
      scheduledAt: classSessions.scheduledAt,
      status: classSessions.status,
      batchId: batches.id,
      batchName: batches.name,
      programId: programs.id,
      programName: programs.name,
      programType: programs.type,
      deliveryMode: programs.deliveryMode,
      markedCount: sql<number>`(
        select count(*)::int from ${attendance}
        where ${attendance.sessionId} = ${classSessions.id}
      )`,
      enrolledCount: sql<number>`(
        select count(*)::int from ${enrollments}
        where ${enrollments.batchId} = ${batches.id}
          and ${enrollments.deletedAt} is null
          and ${enrollments.status} in ('ACTIVE', 'PAUSED')
      )`,
    })
    .from(classSessions)
    .innerJoin(batches, eq(batches.id, classSessions.batchId))
    .innerJoin(programs, eq(programs.id, batches.programId))
    .orderBy(sql`${classSessions.scheduledAt} desc`)
    .limit(limit)
}
