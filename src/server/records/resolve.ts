/**
 * Turning the quick form's four choices into real catalogue rows.
 *
 * The form offers "Mentorship — Offline" and a batch typed as "B1". Those have
 * to become a real `programs` row and a real `batches` row, because everything
 * downstream depends on them: the fees dashboard groups by program, attendance
 * hangs off a batch, and the type/mode split on the dashboard reads the two
 * program columns.
 *
 * Both resolvers are find-or-create and run inside the caller's transaction,
 * so a half-finished record cannot leave an orphan program behind.
 */

import { and, eq, sql } from "drizzle-orm"

import type { DbTx } from "@/db"
import { batches, programs } from "@/db/schema"
import { newId } from "@/lib/ids"
import { splitProgramKind } from "@/lib/programs"
import type { DeliveryMode, ProgramType } from "@/db/schema"
import type { RecordProgramKind } from "@/lib/validation/record"

/** Stable codes for the programs the quick form provisions. */
const CANONICAL: Record<
  RecordProgramKind,
  { code: string; name: string; type: ProgramType; deliveryMode: DeliveryMode }
> = {
  MENTORSHIP__ONLINE: {
    code: "MENTORSHIP-ONLINE",
    name: "Mentorship (Online)",
    type: "MENTORSHIP",
    deliveryMode: "ONLINE",
  },
  MENTORSHIP__OFFLINE: {
    code: "MENTORSHIP-OFFLINE",
    name: "Mentorship (Offline)",
    type: "MENTORSHIP",
    deliveryMode: "OFFLINE",
  },
  TRADING_FLOOR__ONLINE: {
    code: "TRADING-FLOOR-ONLINE",
    name: "Trading Floor (Online)",
    type: "TRADING_FLOOR",
    deliveryMode: "ONLINE",
  },
  TRADING_FLOOR__OFFLINE: {
    code: "TRADING-FLOOR-OFFLINE",
    name: "Trading Floor (Offline)",
    type: "TRADING_FLOOR",
    deliveryMode: "OFFLINE",
  },
}

/**
 * Find the program for one of the four choices, creating it if absent.
 *
 * Prefers an existing program of that exact type and mode over creating a new
 * one, so records entered here land on the programs already in the catalogue
 * rather than silently building a parallel set. When several match, the
 * canonical code wins; that keeps the choice deterministic instead of
 * depending on insertion order.
 */
export async function resolveProgram(
  tx: DbTx,
  kind: RecordProgramKind,
  createdBy: string
): Promise<{ id: string; type: ProgramType; deliveryMode: DeliveryMode; name: string }> {
  const canonical = CANONICAL[kind]
  const { type, deliveryMode } = splitProgramKind(kind)

  const matches = await tx
    .select({
      id: programs.id,
      code: programs.code,
      name: programs.name,
      type: programs.type,
      deliveryMode: programs.deliveryMode,
    })
    .from(programs)
    .where(and(eq(programs.type, type), eq(programs.deliveryMode, deliveryMode)))
    .orderBy(programs.createdAt)

  if (matches.length === 1) return matches[0]

  if (matches.length > 1) {
    const byCode = matches.find((p) => p.code === canonical.code)
    if (byCode) return byCode
    return matches[0]
  }

  const [created] = await tx
    .insert(programs)
    .values({
      id: newId(),
      name: canonical.name,
      code: canonical.code,
      type: canonical.type,
      deliveryMode: canonical.deliveryMode,
      description: "Created automatically from a student record.",
      defaultFeePaise: 0,
      defaultBillingType: "ONE_TIME",
      status: "ACTIVE",
      createdBy,
    })
    .returning({
      id: programs.id,
      type: programs.type,
      deliveryMode: programs.deliveryMode,
      name: programs.name,
    })

  return created
}

/**
 * Find the batch labelled "B1" under a program, creating it if absent.
 *
 * Matching is case-insensitive and ignores surrounding whitespace, so "b1",
 * "B1 " and "B1" are one batch rather than three. Venue and meeting link are
 * left null: the batch form still requires whichever one applies, but a record
 * entered at the desk should not be blocked on knowing the room yet.
 */
export async function resolveBatch(
  tx: DbTx,
  programId: string,
  programCode: string,
  label: string
): Promise<string | null> {
  const name = label.trim()
  if (name === "") return null

  const findExisting = async () => {
    const [row] = await tx
      .select({ id: batches.id })
      .from(batches)
      .where(
        and(
          eq(batches.programId, programId),
          sql`lower(trim(${batches.name})) = ${name.toLowerCase()}`
        )
      )
      .limit(1)
    return row?.id ?? null
  }

  // Reuse before creating. This is what stops "B4" typed on the enrolment form
  // from becoming a second batch alongside the "B4" that already exists.
  const existing = await findExisting()
  if (existing) return existing

  /*
   * Codes are globally unique while names are unique per program, so the code
   * is derived from both. A long program code plus a long batch name could
   * still truncate into a collision, so a couple of suffixed attempts follow
   * before giving up.
   */
  const base = `${programCode}-${name.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`

  for (let attempt = 0; attempt < 3; attempt++) {
    const code = (attempt === 0 ? base : `${base}-${attempt + 1}`).slice(0, 32)

    /*
     * `onConflictDoNothing()` with NO target, deliberately.
     *
     * Naming a single index would leave the other one to raise — and an
     * unhandled unique violation aborts the whole transaction, taking the
     * student, the enrolment and the payment down with it. Catching every
     * conflict lets the lookup below decide what actually happened.
     */
    const [created] = await tx
      .insert(batches)
      .values({ id: newId(), programId, name, code, status: "RUNNING" })
      .onConflictDoNothing()
      .returning({ id: batches.id })

    if (created) return created.id

    // Someone else created this batch between the lookup and the insert.
    const raced = await findExisting()
    if (raced) return raced

    // Otherwise the CODE collided with a different program's batch; try again
    // with a suffix.
  }

  return null
}

/**
 * Batch labels already in use, to suggest in the record form.
 *
 * "Still running" means it has not finished — either no end date was set, or
 * that date is still ahead. Filtering on `end_date IS NULL` alone silently
 * dropped every batch that had one, which is most of them, leaving the
 * suggestions almost empty. Cancelled and completed batches are excluded too:
 * suggesting one would quietly enroll a student into a closed batch.
 */
export async function listBatchLabels(): Promise<string[]> {
  const { db } = await import("@/db")
  const rows = await db
    .selectDistinct({ name: batches.name })
    .from(batches)
    .where(
      and(
        sql`(${batches.endDate} is null
             or ${batches.endDate} >= (now() at time zone 'Asia/Kolkata')::date)`,
        sql`${batches.status} not in ('CANCELLED', 'COMPLETED')`
      )
    )
    .orderBy(batches.name)
    .limit(50)

  return rows.map((r) => r.name)
}
