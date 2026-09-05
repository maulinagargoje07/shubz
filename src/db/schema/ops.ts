/**
 * Operational tables: notes, the audit log, and CSV import staging.
 *
 * `audit_log` is written by every mutation in the system, inside the same
 * transaction as the change itself. If the change rolls back, so does its
 * audit row — the log can never claim something happened that didn't. See
 * lib/audit.ts.
 */

import { relations } from "drizzle-orm"
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

import { users } from "./auth"
import { contacts } from "./contacts"
import { enrollments } from "./enrollment"
import { importRowStatusEnum, importStatusEnum } from "./enums"

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey(),
    /** A note hangs off a contact, an enrollment, or both. */
    contactId: uuid("contact_id").references(() => contacts.id, {
      onDelete: "cascade",
    }),
    enrollmentId: uuid("enrollment_id").references(() => enrollments.id, {
      onDelete: "cascade",
    }),
    body: text("body").notNull(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("notes_contact_id_idx").on(t.contactId),
    index("notes_enrollment_id_idx").on(t.enrollmentId),
    index("notes_created_at_idx").on(t.createdAt),
  ]
)

/**
 * Immutable record of every mutation.
 *
 * `before`/`after` hold the row state either side of the change, so the
 * contact detail page's Activity tab can render "lifecycle_stage: LEAD ->
 * STUDENT" without a separate history table per entity.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** CREATE | UPDATE | DELETE | RESTORE | plus domain verbs like PAYMENT_RECORDED. */
    action: text("action").notNull(),
    /** Table name: "contacts", "enrollments", "payments"... */
    entity: text("entity").notNull(),
    entityId: uuid("entity_id").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Backs the Activity tab: "everything that happened to this record".
    index("audit_log_entity_idx").on(t.entity, t.entityId, t.createdAt),
    index("audit_log_actor_idx").on(t.actorUserId),
    index("audit_log_created_at_idx").on(t.createdAt),
  ]
)

/** One CSV upload. */
export const imports = pgTable(
  "imports",
  {
    id: uuid("id").primaryKey(),
    filename: text("filename").notNull(),
    uploadedBy: uuid("uploaded_by").references(() => users.id, {
      onDelete: "set null",
    }),
    rowCount: integer("row_count").notNull().default(0),
    validCount: integer("valid_count").notNull().default(0),
    dupCount: integer("dup_count").notNull().default(0),
    invalidCount: integer("invalid_count").notNull().default(0),
    /** Which CSV header maps to which contact field. */
    columnMap: jsonb("column_map"),
    status: importStatusEnum("status").notNull().default("PENDING"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    committedAt: timestamp("committed_at", { withTimezone: true }),
  },
  (t) => [index("imports_created_at_idx").on(t.createdAt)]
)

/**
 * One row per CSV line, staged before commit. Keeping the raw line means a
 * rejected row can be explained back to the user ("row 14: phone 98765 is too
 * short") and re-examined after the fact.
 */
export const importRows = pgTable(
  "import_rows",
  {
    id: uuid("id").primaryKey(),
    importId: uuid("import_id")
      .notNull()
      .references(() => imports.id, { onDelete: "cascade" }),
    rowNumber: integer("row_number").notNull(),
    raw: jsonb("raw").notNull(),
    status: importRowStatusEnum("status").notNull(),
    errorMessage: text("error_message"),
    /** Normalised phone, so dedupe within the file is a plain index scan. */
    phoneE164: text("phone_e164"),
    createdContactId: uuid("created_contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    index("import_rows_import_id_idx").on(t.importId),
    index("import_rows_status_idx").on(t.status),
    index("import_rows_phone_idx").on(t.phoneE164),
  ]
)

export const notesRelations = relations(notes, ({ one }) => ({
  contact: one(contacts, {
    fields: [notes.contactId],
    references: [contacts.id],
  }),
  enrollment: one(enrollments, {
    fields: [notes.enrollmentId],
    references: [enrollments.id],
  }),
  author: one(users, { fields: [notes.createdBy], references: [users.id] }),
}))

export const importsRelations = relations(imports, ({ many, one }) => ({
  rows: many(importRows),
  uploader: one(users, {
    fields: [imports.uploadedBy],
    references: [users.id],
  }),
}))

export const importRowsRelations = relations(importRows, ({ one }) => ({
  import: one(imports, {
    fields: [importRows.importId],
    references: [imports.id],
  }),
}))

export type Note = typeof notes.$inferSelect
export type AuditLogEntry = typeof auditLog.$inferSelect
export type ImportBatch = typeof imports.$inferSelect
export type ImportRow = typeof importRows.$inferSelect
