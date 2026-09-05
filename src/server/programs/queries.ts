import { asc, eq, sql } from "drizzle-orm"

import { db } from "@/db"
import { batches, enrollments, programs } from "@/db/schema"

export async function listPrograms() {
  // Batch and live-enrollment counts come from correlated subqueries rather
  // than joins, so a program with many enrollments is not multiplied out.
  return db
    .select({
      id: programs.id,
      name: programs.name,
      code: programs.code,
      type: programs.type,
      deliveryMode: programs.deliveryMode,
      defaultFeePaise: programs.defaultFeePaise,
      defaultBillingType: programs.defaultBillingType,
      defaultBillingCycle: programs.defaultBillingCycle,
      status: programs.status,
      batchCount: sql<number>`(
        select count(*)::int from ${batches} where ${batches.programId} = ${programs.id}
      )`,
      activeEnrollments: sql<number>`(
        select count(*)::int from ${enrollments}
        where ${enrollments.programId} = ${programs.id}
          and ${enrollments.status} = 'ACTIVE'
          and ${enrollments.deletedAt} is null
      )`,
    })
    .from(programs)
    .orderBy(asc(programs.name))
}

export async function getProgram(id: string) {
  const [row] = await db.select().from(programs).where(eq(programs.id, id)).limit(1)
  return row ?? null
}

export async function getProgramByCode(code: string, excludeId?: string) {
  const [row] = await db
    .select({ id: programs.id, name: programs.name })
    .from(programs)
    .where(eq(programs.code, code))
    .limit(1)

  if (!row) return null
  if (excludeId && row.id === excludeId) return null
  return row
}

/** Programs available to enroll into. */
export async function listSelectablePrograms() {
  return db
    .select({
      id: programs.id,
      name: programs.name,
      type: programs.type,
      deliveryMode: programs.deliveryMode,
      defaultFeePaise: programs.defaultFeePaise,
      defaultBillingType: programs.defaultBillingType,
      defaultBillingCycle: programs.defaultBillingCycle,
    })
    .from(programs)
    .orderBy(asc(programs.name))
}
