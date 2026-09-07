import { and, asc, count, eq, gte, lte, sql } from "drizzle-orm"

import { db } from "@/db"
import { batches, classSessions, programs } from "@/db/schema"

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
        select count(*)::int
        from attendance a
        where a.session_id = sessions.id
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
        select count(*)::int
        from attendance a
        where a.session_id = sessions.id
      )`,
      enrolledCount: sql<number>`(
        select count(*)::int
        from enrollments e
        join contacts c on c.id = e.contact_id and c.deleted_at is null
        where e.batch_id = batches.id
          and e.deleted_at is null
          and e.status in ('ACTIVE', 'PAUSED')
      )`,
    })
    .from(classSessions)
    .innerJoin(batches, eq(batches.id, classSessions.batchId))
    .innerJoin(programs, eq(programs.id, batches.programId))
    .orderBy(sql`${classSessions.scheduledAt} desc`)
    .limit(limit)
}


/**
 * Batches you can schedule classes into, with the sequence number the next
 * session would take.
 *
 * Finished and cancelled batches are excluded — scheduling a class into a
 * batch that has ended is almost always a mistake, and offering it invites one.
 */
export async function listSchedulableBatches() {
  const rows = await db
    .select({
      id: batches.id,
      name: batches.name,
      endDate: batches.endDate,
      programName: programs.name,
      deliveryMode: programs.deliveryMode,
      nextSeq: sql<number>`(
        select coalesce(max(s.seq), 0)::int + 1
        from sessions s
        where s.batch_id = batches.id
      )`,
    })
    .from(batches)
    .innerJoin(programs, eq(programs.id, batches.programId))
    .where(sql`${batches.status} not in ('CANCELLED', 'COMPLETED')`)
    .orderBy(asc(programs.name), asc(batches.name))

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    programName: row.programName,
    deliveryMode: row.deliveryMode,
    endDate: row.endDate,
    nextSeq: Number(row.nextSeq),
  }))
}
