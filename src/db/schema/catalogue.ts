/**
 * The catalogue: programs -> batches -> sessions.
 *
 * `type` and `delivery_mode` on programs are TWO SEPARATE COLUMNS, deliberately.
 * The UI shows one combined selector ("Trading Floor — Offline") and writes
 * both, but storage keeps them independent so queries can ask "all mentorship
 * regardless of mode" and "everyone who attends offline" without parsing
 * strings.
 *
 * delivery_mode also decides what a batch requires: ONLINE needs a meeting
 * link, OFFLINE needs a venue. That conditional is enforced in the zod schema
 * and reflected in the form, which shows one branch or the other, never both.
 */

import { relations } from "drizzle-orm"
import {
  bigint,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

import { users } from "./auth"
import {
  batchStatusEnum,
  billingCycleEnum,
  billingTypeEnum,
  deliveryModeEnum,
  programStatusEnum,
  programTypeEnum,
  sessionStatusEnum,
} from "./enums"

export const programs = pgTable(
  "programs",
  {
    id: uuid("id").primaryKey(),
    name: text("name").notNull(),
    code: text("code").notNull().unique(),

    type: programTypeEnum("type").notNull(),
    deliveryMode: deliveryModeEnum("delivery_mode").notNull(),

    description: text("description"),

    /** Paise. See lib/money.ts — never rupees, never a decimal type. */
    defaultFeePaise: bigint("default_fee_paise", { mode: "number" })
      .notNull()
      .default(0),
    defaultDurationDays: integer("default_duration_days"),

    defaultBillingType: billingTypeEnum("default_billing_type")
      .notNull()
      .default("ONE_TIME"),
    /** Null for ONE_TIME programs. */
    defaultBillingCycle: billingCycleEnum("default_billing_cycle"),

    status: programStatusEnum("status").notNull().default("DRAFT"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    index("programs_type_idx").on(t.type),
    index("programs_delivery_mode_idx").on(t.deliveryMode),
    index("programs_status_idx").on(t.status),
  ]
)

export const batches = pgTable(
  "batches",
  {
    id: uuid("id").primaryKey(),
    programId: uuid("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "restrict" }),

    name: text("name").notNull(),
    code: text("code").notNull().unique(),

    startDate: date("start_date"),
    endDate: date("end_date"),
    /** Free text, e.g. "Mon/Wed/Fri 7:30-9:00 PM". */
    timingText: text("timing_text"),

    mentorUserId: uuid("mentor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    capacity: integer("capacity"),

    /** Required when the parent program is ONLINE. */
    meetingLink: text("meeting_link"),
    /** Required when the parent program is OFFLINE. */
    venueName: text("venue_name"),
    venueAddress: text("venue_address"),
    /** Offline only — physical desks available. */
    seatCapacity: integer("seat_capacity"),

    status: batchStatusEnum("status").notNull().default("PLANNED"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("batches_program_id_idx").on(t.programId),
    index("batches_status_idx").on(t.status),
    index("batches_start_date_idx").on(t.startDate),
  ]
)

/** Individual classes inside a batch. */
export const classSessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => batches.id, { onDelete: "cascade" }),

    /** Ordinal within the batch: session 1, 2, 3... */
    seq: integer("seq").notNull(),
    title: text("title").notNull(),

    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(90),

    /** Online sessions. */
    meetingLink: text("meeting_link"),
    /** Offline sessions — room or desk block. */
    roomOrDesk: text("room_or_desk"),
    recordingLink: text("recording_link"),

    status: sessionStatusEnum("status").notNull().default("SCHEDULED"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("sessions_batch_seq_uq").on(t.batchId, t.seq),
    index("sessions_batch_id_idx").on(t.batchId),
    index("sessions_scheduled_at_idx").on(t.scheduledAt),
    index("sessions_status_idx").on(t.status),
  ]
)

export const programsRelations = relations(programs, ({ many }) => ({
  batches: many(batches),
}))

export const batchesRelations = relations(batches, ({ one, many }) => ({
  program: one(programs, {
    fields: [batches.programId],
    references: [programs.id],
  }),
  mentor: one(users, {
    fields: [batches.mentorUserId],
    references: [users.id],
  }),
  sessions: many(classSessions),
}))

export const classSessionsRelations = relations(classSessions, ({ one }) => ({
  batch: one(batches, { fields: [classSessions.batchId], references: [batches.id] }),
}))

export type Program = typeof programs.$inferSelect
export type NewProgram = typeof programs.$inferInsert
export type ProgramType = Program["type"]
export type DeliveryMode = Program["deliveryMode"]
export type BillingType = Program["defaultBillingType"]
export type BillingCycle = NonNullable<Program["defaultBillingCycle"]>
export type Batch = typeof batches.$inferSelect
export type NewBatch = typeof batches.$inferInsert
export type ClassSession = typeof classSessions.$inferSelect
export type NewClassSession = typeof classSessions.$inferInsert
export type SessionStatus = ClassSession["status"]
