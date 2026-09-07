"use server"

import { revalidateEverything } from "@/lib/revalidate"
import { and, eq, isNull } from "drizzle-orm"

import { db } from "@/db"
import {
  attendance,
  batches,
  classSessions,
  contacts,
  enrollments,
  programs,
} from "@/db/schema"
import { mutate } from "@/lib/audit"
import { newId } from "@/lib/ids"
import { checkPermission } from "@/lib/session"
import { attendanceMarkSchema } from "@/lib/validation/attendance"
import type { ActionResult } from "@/lib/validation/shared"

/**
 * Save a whole register at once.
 *
 * Upserting on the (session, enrollment) unique index makes re-marking
 * idempotent — an admin correcting one student does not create a duplicate row
 * or need the register cleared first.
 *
 * `source` follows the program's delivery mode: an offline class is a physical
 * check-in, an online one is marked by hand until a Zoom import exists.
 */
export async function markAttendance(input: unknown): Promise<ActionResult<{ count: number }>> {
  const gate = await checkPermission("MANAGE_ATTENDANCE")
  if (!gate.ok) return gate
  const user = gate.user

  const parsed = attendanceMarkSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Nothing to save." }

  const { sessionId, entries } = parsed.data

  const [context] = await db
    .select({
      sessionId: classSessions.id,
      batchId: batches.id,
      programId: programs.id,
      deliveryMode: programs.deliveryMode,
      scheduledAt: classSessions.scheduledAt,
      status: classSessions.status,
    })
    .from(classSessions)
    .innerJoin(batches, eq(batches.id, classSessions.batchId))
    .innerJoin(programs, eq(programs.id, batches.programId))
    .where(eq(classSessions.id, sessionId))
    .limit(1)

  if (!context) return { ok: false, error: "That session no longer exists." }

  /**
   * Only the batch's own roster may be marked.
   *
   * The action previously trusted whatever enrollment ids arrived, so a
   * crafted payload could write attendance for a student in a different batch
   * entirely — rows that then counted toward that student's attendance
   * percentage. Resolving the roster server-side and intersecting with it
   * closes that, and also drops rows for anyone whose enrollment was deleted
   * while the register was open on screen.
   */
  const roster = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .innerJoin(contacts, eq(contacts.id, enrollments.contactId))
    .where(
      and(
        eq(enrollments.batchId, context.batchId),
        isNull(enrollments.deletedAt),
        isNull(contacts.deletedAt)
      )
    )

  const allowed = new Set(roster.map((r) => r.id))
  const valid = entries.filter((entry) => allowed.has(entry.enrollmentId))
  const rejected = entries.length - valid.length

  if (valid.length === 0) {
    return { ok: false, error: "Nobody on this batch's roster was in that register." }
  }

  const source = context.deliveryMode === "OFFLINE" ? "PHYSICAL_CHECKIN" : "MANUAL"
  const markedAt = new Date()

  /**
   * Marking a register that has already happened completes the session.
   *
   * Nothing else ever moved a session off SCHEDULED, yet the attendance
   * percentage counted only sessions that had happened — so a fully marked
   * register still showed "no sessions held". Taking the register is the
   * natural signal that the class ran. Future sessions are left alone (someone
   * pre-marking a roster has not held the class yet), and CANCELLED is never
   * overridden.
   */
  const alreadyHappened = context.scheduledAt <= markedAt
  const shouldComplete = alreadyHappened && context.status === "SCHEDULED"

  await mutate(user, async ({ tx, audit }) => {
    for (const entry of valid) {
      await tx
        .insert(attendance)
        .values({
          id: newId(),
          sessionId,
          enrollmentId: entry.enrollmentId,
          status: entry.status,
          markedAt,
          markedByUserId: user.id,
          source,
        })
        .onConflictDoUpdate({
          target: [attendance.sessionId, attendance.enrollmentId],
          set: {
            status: entry.status,
            markedAt,
            markedByUserId: user.id,
            source,
          },
        })
    }

    if (shouldComplete) {
      await tx
        .update(classSessions)
        .set({ status: "COMPLETED", updatedAt: new Date() })
        .where(eq(classSessions.id, sessionId))
    }

    await audit({
      action: "ATTENDANCE_MARKED",
      entity: "sessions",
      entityId: sessionId,
      after: {
        sessionId,
        source,
        marked: valid.length,
        rejected,
        completedSession: shouldComplete,
        entries: valid,
      },
    })
  })

  revalidateEverything()
  return { ok: true, data: { count: valid.length } }
}
