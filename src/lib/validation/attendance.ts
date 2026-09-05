import { z } from "zod"

import { uuidSchema } from "./shared"

export const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const

/**
 * A whole register saved in one go.
 *
 * Attendance is marked for a session as a unit, not row by row: the offline
 * flow is "mark all present, uncheck the absentees, save". Sending the whole
 * register means a save is idempotent and cannot half-apply.
 */
export const attendanceMarkSchema = z.object({
  sessionId: uuidSchema,
  entries: z
    .array(
      z.object({
        enrollmentId: uuidSchema,
        status: z.enum(ATTENDANCE_STATUSES),
      })
    )
    .min(1, "Nobody to mark"),
})

export type AttendanceMarkValues = z.infer<typeof attendanceMarkSchema>
