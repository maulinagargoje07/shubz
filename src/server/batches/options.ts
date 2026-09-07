/**
 * Batch options for filter dropdowns.
 *
 * Batches are named per program ("B1" under Mentorship Online, "B1" under
 * Trading Floor Kharadi), so a filter listing bare names would be ambiguous —
 * picking "B1" could mean either. The value is the batch id and the label
 * carries the program, which keeps the choice unambiguous while still reading
 * naturally.
 *
 * Grouped by program so a long list stays navigable in a native <select>.
 */

import { asc, eq, isNull, sql } from "drizzle-orm"

import { db } from "@/db"
import { batches, enrollments, programs } from "@/db/schema"
import { programKindLabelOf } from "@/lib/programs"

/**
 * "Mentorship (Offline)" as a program name is common, and the kind label is
 * the same string — appending it unconditionally produced
 * "Mentorship (Offline) — Mentorship (Offline)". Only add the kind when it
 * tells the reader something the name does not.
 */
function groupLabel(programName: string, kindLabel: string): string {
  const name = programName.trim()
  return name.toLowerCase() === kindLabel.toLowerCase()
    ? name
    : `${name} — ${kindLabel}`
}

export type BatchOption = {
  value: string
  label: string
  /** Program name, so the UI can render <optgroup>s. */
  group: string
  enrollmentCount: number
}

/**
 * Every batch that has at least one live enrollment, plus every batch that is
 * still open. Batches nobody is in and which are finished are omitted — a
 * filter option that can only ever return nothing is noise.
 */
export async function listBatchOptions(): Promise<BatchOption[]> {
  const rows = await db
    .select({
      id: batches.id,
      name: batches.name,
      status: batches.status,
      programName: programs.name,
      programType: programs.type,
      deliveryMode: programs.deliveryMode,
      enrollmentCount: sql<number>`(
        select count(*)::int
        from enrollments e
        join contacts c on c.id = e.contact_id and c.deleted_at is null
        where e.batch_id = batches.id
          and e.deleted_at is null
      )`,
    })
    .from(batches)
    .innerJoin(programs, eq(programs.id, batches.programId))
    .orderBy(asc(programs.name), asc(batches.name))

  return rows
    .filter(
      (row) =>
        Number(row.enrollmentCount) > 0 ||
        (row.status !== "COMPLETED" && row.status !== "CANCELLED")
    )
    .map((row) => ({
      value: row.id,
      label:
        Number(row.enrollmentCount) > 0
          ? `${row.name} (${row.enrollmentCount})`
          : row.name,
      group: groupLabel(
        row.programName,
        programKindLabelOf(row.programType, row.deliveryMode)
      ),
      enrollmentCount: Number(row.enrollmentCount),
    }))
}

/** How many live enrollments sit outside any batch, for the "No batch" option. */
export async function countUnbatchedEnrollments(): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(enrollments)
    .where(isNull(enrollments.batchId))

  return Number(row?.value ?? 0)
}

/** Resolve a batch id to a display name, for the "filtered by" summary. */
export async function getBatchLabel(batchId: string): Promise<string | null> {
  const [row] = await db
    .select({ name: batches.name, programName: programs.name })
    .from(batches)
    .innerJoin(programs, eq(programs.id, batches.programId))
    .where(eq(batches.id, batchId))
    .limit(1)

  return row ? `${row.name} · ${row.programName}` : null
}
