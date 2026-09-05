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

import { and, eq, isNull, sql } from "drizzle-orm"

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

  const [existing] = await tx
    .select({ id: batches.id })
    .from(batches)
    .where(
      and(
        eq(batches.programId, programId),
        sql`lower(trim(${batches.name})) = ${name.toLowerCase()}`
      )
    )
    .limit(1)

  if (existing) return existing.id

  // Codes are globally unique, so scope by program to avoid colliding with a
  // "B1" under a different program.
  const code = `${programCode}-${name.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`.slice(0, 32)

  const [created] = await tx
    .insert(batches)
    .values({
      id: newId(),
      programId,
      name,
      code,
      status: "RUNNING",
    })
    .onConflictDoNothing({ target: batches.code })
    .returning({ id: batches.id })

  if (created) return created.id

  // Lost a race, or the code was already taken by another program's batch.
  const [fallback] = await tx
    .select({ id: batches.id })
    .from(batches)
    .where(
      and(
        eq(batches.programId, programId),
        sql`lower(trim(${batches.name})) = ${name.toLowerCase()}`
      )
    )
    .limit(1)

  return fallback?.id ?? null
}

/** Batch labels already in use, so the form can suggest them. */
export async function listBatchLabels(): Promise<string[]> {
  const { db } = await import("@/db")
  const rows = await db
    .selectDistinct({ name: batches.name })
    .from(batches)
    .where(isNull(batches.endDate))
    .orderBy(batches.name)
    .limit(50)

  return rows.map((r) => r.name)
}
