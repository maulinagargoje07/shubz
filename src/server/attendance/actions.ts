"use server"

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"

import { db } from "@/db"
import { attendance, batches, classSessions, programs } from "@/db/schema"
import { mutate } from "@/lib/audit"
import { newId } from "@/lib/ids"
import { requireUser } from "@/lib/session"
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
  const user = await requireUser()

  const parsed = attendanceMarkSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Nothing to save." }

  const { sessionId, entries } = parsed.data

  const [context] = await db
    .select({
      sessionId: classSessions.id,
      batchId: batches.id,
      programId: programs.id,
      deliveryMode: programs.deliveryMode,
    })
    .from(classSessions)
    .innerJoin(batches, eq(batches.id, classSessions.batchId))
    .innerJoin(programs, eq(programs.id, batches.programId))
    .where(eq(classSessions.id, sessionId))
    .limit(1)

  if (!context) return { ok: false, error: "That session no longer exists." }

  const source = context.deliveryMode === "OFFLINE" ? "PHYSICAL_CHECKIN" : "MANUAL"
  const markedAt = new Date()

  await mutate(user, async ({ tx, audit }) => {
    for (const entry of entries) {
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

    await audit({
      action: "ATTENDANCE_MARKED",
      entity: "sessions",
      entityId: sessionId,
      after: { sessionId, source, entries },
    })
  })

  revalidatePath(`/attendance/${sessionId}`)
  revalidatePath(`/programs/${context.programId}/batches/${context.batchId}`)
  return { ok: true, data: { count: entries.length } }
}
