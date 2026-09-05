/**
 * Enrollment and money.
 *
 * The invariant that governs this file: BALANCE IS NEVER STORED. It is read
 * from the `enrollment_balances` SQL view (see db/views.ts and the 0001
 * migration), computed from the payments ledger and the payment schedule. A
 * stored balance column would drift the first time a payment was corrected.
 *
 * `payments` is an append-only ledger. Corrections soft-delete a row and
 * record a new one; financial records are never hard-deleted or edited in
 * place, so the ledger always reconstructs how a balance came to be.
 *
 * Recurring billing: `fee_total_paise` is the amount for ONE billing cycle
 * (₹5,000/month, not a 12-month total). Cycles materialise as payment_schedule
 * rows that roll forward as they are paid. This makes one-time and recurring
 * enrollments share a single overdue rule — an unpaid schedule row past its
 * due date — and lets an open-ended membership exist without inventing a
 * contract total.
 */

import { relations, sql } from "drizzle-orm"
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
import { batches, classSessions, programs } from "./catalogue"
import { contacts } from "./contacts"
import {
  attendanceSourceEnum,
  attendanceStatusEnum,
  billingCycleEnum,
  billingTypeEnum,
  contactSourceEnum,
  enrollmentStatusEnum,
  paymentMethodEnum,
  paymentScheduleStatusEnum,
} from "./enums"

export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid("id").primaryKey(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "restrict" }),
    programId: uuid("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "restrict" }),
    /** Nullable: a Trading Floor membership may run without a batch. */
    batchId: uuid("batch_id").references(() => batches.id, { onDelete: "set null" }),

    status: enrollmentStatusEnum("status").notNull().default("ACTIVE"),

    enrolledOn: date("enrolled_on").notNull(),
    startDate: date("start_date"),
    endDate: date("end_date"),

    /** Paise. For RECURRING this is ONE cycle's fee, not a contract total. */
    feeTotalPaise: bigint("fee_total_paise", { mode: "number" }).notNull().default(0),
    discountPaise: bigint("discount_paise", { mode: "number" }).notNull().default(0),

    billingType: billingTypeEnum("billing_type").notNull().default("ONE_TIME"),
    /** Null for ONE_TIME. */
    billingCycle: billingCycleEnum("billing_cycle"),
    /**
     * Denormalised convenience mirror of the earliest unpaid schedule row.
     * Recomputed inside the same transaction as any payment or schedule
     * change. `enrollment_balances.next_due_date` is the authority; this
     * column exists so enrollment lists can sort without joining the view.
     */
    nextDueDate: date("next_due_date"),

    /** Offline Trading Floor desk allocation. */
    seatNumber: text("seat_number"),

    source: contactSourceEnum("source"),
    assignedMentorUserId: uuid("assigned_mentor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    /**
     * One live enrollment per contact per batch. Partial, because batch_id is
     * nullable (batchless memberships must not collide with each other) and
     * because a dropped-then-soft-deleted enrollment should not block a
     * genuine re-enrollment.
     */
    uniqueIndex("enrollments_contact_batch_live_uq")
      .on(t.contactId, t.batchId)
      .where(sql`${t.batchId} is not null and ${t.deletedAt} is null`),

    /** A physical desk cannot be held by two live students at once. */
    uniqueIndex("enrollments_batch_seat_live_uq")
      .on(t.batchId, t.seatNumber)
      .where(
        sql`${t.batchId} is not null and ${t.seatNumber} is not null and ${t.deletedAt} is null`
      ),

    index("enrollments_contact_id_idx").on(t.contactId),
    index("enrollments_program_id_idx").on(t.programId),
    index("enrollments_batch_id_idx").on(t.batchId),
    index("enrollments_status_idx").on(t.status),
    index("enrollments_next_due_date_idx").on(t.nextDueDate),
  ]
)

/**
 * Append-only payments ledger.
 *
 * `receipt_no` is generated inside the recording transaction, scoped to the
 * Indian financial year (ST-2026-000123 covers Apr 2026 - Mar 2027), so one
 * financial year forms a contiguous block for the accountant.
 */
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "restrict" }),

    amountPaise: bigint("amount_paise", { mode: "number" }).notNull(),
    paidOn: date("paid_on").notNull(),

    method: paymentMethodEnum("method").notNull(),
    /** UPI txn id, cheque number, bank reference. */
    referenceNo: text("reference_no"),
    receiptNo: text("receipt_no").notNull().unique(),

    notes: text("notes"),
    recordedByUserId: uuid("recorded_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("payments_enrollment_id_idx").on(t.enrollmentId),
    index("payments_paid_on_idx").on(t.paidOn),
    index("payments_method_idx").on(t.method),
  ]
)

/**
 * Planned installments — the "what is owed and when" side of the ledger.
 *
 * Rows are generated from NET payable (fee minus discount), so for a one-time
 * enrollment SUM(amount_paise) equals fee_total - discount exactly and the two
 * branches of the balances view agree.
 *
 * `status` is derived state, recomputed by FIFO-allocating payments
 * oldest-due-first after every payment change, in the same transaction.
 */
export const paymentSchedule = pgTable(
  "payment_schedule",
  {
    id: uuid("id").primaryKey(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),

    seq: integer("seq").notNull(),
    dueDate: date("due_date").notNull(),
    amountPaise: bigint("amount_paise", { mode: "number" }).notNull(),

    status: paymentScheduleStatusEnum("status").notNull().default("PENDING"),
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("payment_schedule_enrollment_seq_uq").on(t.enrollmentId, t.seq),
    index("payment_schedule_enrollment_id_idx").on(t.enrollmentId),
    index("payment_schedule_due_date_idx").on(t.dueDate),
    index("payment_schedule_status_idx").on(t.status),
  ]
)

export const attendance = pgTable(
  "attendance",
  {
    id: uuid("id").primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => classSessions.id, { onDelete: "cascade" }),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),

    status: attendanceStatusEnum("status").notNull(),
    markedAt: timestamp("marked_at", { withTimezone: true }).notNull().defaultNow(),
    markedByUserId: uuid("marked_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** PHYSICAL_CHECKIN for offline programs, MANUAL for online. */
    source: attendanceSourceEnum("source").notNull().default("MANUAL"),
  },
  (t) => [
    // Makes re-marking a register an idempotent upsert.
    uniqueIndex("attendance_session_enrollment_uq").on(t.sessionId, t.enrollmentId),
    index("attendance_enrollment_id_idx").on(t.enrollmentId),
    index("attendance_status_idx").on(t.status),
  ]
)

export const enrollmentsRelations = relations(enrollments, ({ one, many }) => ({
  contact: one(contacts, {
    fields: [enrollments.contactId],
    references: [contacts.id],
  }),
  program: one(programs, {
    fields: [enrollments.programId],
    references: [programs.id],
  }),
  batch: one(batches, {
    fields: [enrollments.batchId],
    references: [batches.id],
  }),
  mentor: one(users, {
    fields: [enrollments.assignedMentorUserId],
    references: [users.id],
  }),
  payments: many(payments),
  schedule: many(paymentSchedule),
  attendance: many(attendance),
}))

export const paymentsRelations = relations(payments, ({ one }) => ({
  enrollment: one(enrollments, {
    fields: [payments.enrollmentId],
    references: [enrollments.id],
  }),
  recordedBy: one(users, {
    fields: [payments.recordedByUserId],
    references: [users.id],
  }),
}))

export const paymentScheduleRelations = relations(paymentSchedule, ({ one }) => ({
  enrollment: one(enrollments, {
    fields: [paymentSchedule.enrollmentId],
    references: [enrollments.id],
  }),
}))

export const attendanceRelations = relations(attendance, ({ one }) => ({
  session: one(classSessions, {
    fields: [attendance.sessionId],
    references: [classSessions.id],
  }),
  enrollment: one(enrollments, {
    fields: [attendance.enrollmentId],
    references: [enrollments.id],
  }),
}))

export type Enrollment = typeof enrollments.$inferSelect
export type NewEnrollment = typeof enrollments.$inferInsert
export type EnrollmentStatus = Enrollment["status"]
export type Payment = typeof payments.$inferSelect
export type NewPayment = typeof payments.$inferInsert
export type PaymentMethod = Payment["method"]
export type PaymentScheduleRow = typeof paymentSchedule.$inferSelect
export type NewPaymentScheduleRow = typeof paymentSchedule.$inferInsert
export type Attendance = typeof attendance.$inferSelect
export type AttendanceStatus = Attendance["status"]
