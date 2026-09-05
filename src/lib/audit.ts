/**
 * The audit log.
 *
 * Every mutation in this system records what changed, who changed it, and what
 * the row looked like either side. The rule that makes the log trustworthy:
 * the audit row is written INSIDE the same transaction as the change. If the
 * change rolls back, so does its audit row — the log can never claim something
 * happened that didn't, and can never miss something that did.
 *
 * Usage:
 *
 *   await mutate(actor, async ({ tx, audit }) => {
 *     const [row] = await tx.insert(contacts).values(...).returning()
 *     await audit({ action: "CREATE", entity: "contacts", entityId: row.id, after: row })
 *     return row
 *   })
 */

import { db, type DbTx } from "@/db"
import { auditLog } from "@/db/schema"
import { newId } from "@/lib/ids"

export type AuditEntry = {
  /** CREATE | UPDATE | DELETE | RESTORE, or a domain verb: PAYMENT_RECORDED. */
  action: string
  /** The table name: "contacts", "enrollments", "payments"... */
  entity: string
  entityId: string
  before?: unknown
  after?: unknown
}

export type Actor = { id: string } | null | undefined

export type MutateContext = {
  tx: DbTx
  audit: (entry: AuditEntry) => Promise<void>
}

/**
 * Run a mutation in a transaction with an audit writer bound to the actor.
 *
 * jsonb columns cannot hold `undefined`, and Date objects must be serialised,
 * so row snapshots pass through `snapshot()` on the way in.
 */
export async function mutate<T>(
  actor: Actor,
  fn: (ctx: MutateContext) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    const audit = async (entry: AuditEntry) => {
      await tx.insert(auditLog).values({
        id: newId(),
        actorUserId: actor?.id ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        before: snapshot(entry.before),
        after: snapshot(entry.after),
      })
    }

    return fn({ tx, audit })
  })
}

/**
 * Make a row safe for a jsonb column: Dates to ISO strings, undefined dropped.
 * Returns null rather than undefined so the column is explicitly empty.
 */
export function snapshot(value: unknown): unknown {
  if (value === undefined || value === null) return null
  return JSON.parse(
    JSON.stringify(value, (_key, v) => (v instanceof Date ? v.toISOString() : v))
  )
}

/**
 * The subset of fields that actually changed, for a readable Activity tab.
 * Comparing snapshots avoids "updated_at changed" noise on every row.
 */
export function diffFields(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
  ignore: string[] = ["updatedAt", "updated_at"]
): string[] {
  if (!before || !after) return []
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  const changed: string[] = []
  for (const key of keys) {
    if (ignore.includes(key)) continue
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) changed.push(key)
  }
  return changed
}
