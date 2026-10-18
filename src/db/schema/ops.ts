/**
 * The audit log.
 *
 * `audit_log` is written by every mutation in the system, inside the same
 * transaction as the change itself. If the change rolls back, so does its
 * audit row — the log can never claim something happened that didn't. See
 * lib/audit.ts.
 *
 * One kind of change is not a local row: ticking "TradingView access given"
 * updates a subscriber held by the shubztrader-payments service. Its audit
 * row is written once that service has confirmed the change, so the log
 * still never claims something that didn't happen.
 */

import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { users } from "./auth"

/**
 * Immutable record of every mutation.
 *
 * `before`/`after` hold the state either side of the change, so a history view
 * can render "granted: false -> true" without a separate table per entity.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** USER_CREATED, TRADINGVIEW_ACCESS_GRANTED, PASSWORD_CHANGED... */
    action: text("action").notNull(),
    /** What changed: "user", or "subscriber" for an indicator buyer. */
    entity: text("entity").notNull(),
    /**
     * Text rather than uuid: users are keyed by UUID v7, but a subscriber's key
     * is its Razorpay subscription ID ("sub_..."), which comes from Razorpay.
     */
    entityId: text("entity_id").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // "Everything that happened to this record".
    index("audit_log_entity_idx").on(t.entity, t.entityId, t.createdAt),
    index("audit_log_actor_idx").on(t.actorUserId),
    index("audit_log_created_at_idx").on(t.createdAt),
  ]
)

export type AuditLogEntry = typeof auditLog.$inferSelect
