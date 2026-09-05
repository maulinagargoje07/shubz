/**
 * People.
 *
 * ONE table holds everyone: leads, webinar registrants and paying students
 * alike, distinguished only by `lifecycle_stage`. There is deliberately no
 * separate students table — the Students page is a filtered view of this one.
 * A lead who pays becomes a STUDENT by an UPDATE, not a migration between
 * tables, so their history, notes and messages survive the transition.
 */

import { relations } from "drizzle-orm"
import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

import { users } from "./auth"
import {
  consentActionEnum,
  consentChannelEnum,
  contactSourceEnum,
  lifecycleStageEnum,
} from "./enums"

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey(),

    fullName: text("full_name").notNull(),

    /** Canonical E.164, e.g. "+919876543210". The identity of a contact. */
    phoneE164: text("phone_e164").notNull(),
    /** Exactly what was typed or imported, kept for audit and support. */
    phoneRaw: text("phone_raw"),
    altPhone: text("alt_phone"),

    email: text("email"),
    city: text("city"),
    state: text("state"),

    lifecycleStage: lifecycleStageEnum("lifecycle_stage").notNull().default("LEAD"),
    source: contactSourceEnum("source").notNull().default("OTHER"),

    telegramUsername: text("telegram_username"),
    tradingviewUsername: text("tradingview_username"),

    /** WhatsApp business-scoped user id. Populated when messaging is connected. */
    whatsappBsuid: text("whatsapp_bsuid"),
    /** Last inbound message. Drives the WhatsApp 24-hour service window. */
    lastInboundAt: timestamp("last_inbound_at", { withTimezone: true }),

    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    /**
     * Unique among LIVE contacts only. A soft-deleted contact releases its
     * number so the same person can be re-added, and so the CSV importer
     * dedupes against people who actually exist.
     */
    uniqueIndex("contacts_phone_e164_live_uq")
      .on(t.phoneE164)
      .where(sql`${t.deletedAt} is null`),

    index("contacts_lifecycle_stage_idx").on(t.lifecycleStage),
    index("contacts_source_idx").on(t.source),
    index("contacts_email_idx").on(t.email),
    index("contacts_created_at_idx").on(t.createdAt),
    // Backs the list page's name search.
    index("contacts_full_name_idx").on(t.fullName),
  ]
)

export const tags = pgTable("tags", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull().unique(),
  colour: text("colour").notNull().default("#64748b"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const contactTags = pgTable(
  "contact_tags",
  {
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.contactId, t.tagId] }),
    index("contact_tags_tag_id_idx").on(t.tagId),
  ]
)

/**
 * Consent, as an append-only event log.
 *
 * There is deliberately NO boolean opt-in column. Opt-in status is DERIVED as
 * the latest event per (contact, channel). That keeps the full history — when
 * someone opted in, under what wording, from where — which is what a consent
 * record is actually for. A boolean would throw that away and could not answer
 * "what exactly did they agree to, and when".
 */
export const consentEvents = pgTable(
  "consent_events",
  {
    id: uuid("id").primaryKey(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    channel: consentChannelEnum("channel").notNull(),
    action: consentActionEnum("action").notNull(),
    /** The exact wording the contact agreed to. */
    consentText: text("consent_text"),
    source: text("source"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    recordedBy: uuid("recorded_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    // Backs "latest event per contact per channel".
    index("consent_events_contact_channel_idx").on(
      t.contactId,
      t.channel,
      t.occurredAt
    ),
  ]
)

export const contactsRelations = relations(contacts, ({ many, one }) => ({
  tags: many(contactTags),
  consentEvents: many(consentEvents),
  createdByUser: one(users, {
    fields: [contacts.createdBy],
    references: [users.id],
  }),
}))

export const contactTagsRelations = relations(contactTags, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactTags.contactId],
    references: [contacts.id],
  }),
  tag: one(tags, { fields: [contactTags.tagId], references: [tags.id] }),
}))

export const tagsRelations = relations(tags, ({ many }) => ({
  contacts: many(contactTags),
}))

export const consentEventsRelations = relations(consentEvents, ({ one }) => ({
  contact: one(contacts, {
    fields: [consentEvents.contactId],
    references: [contacts.id],
  }),
}))

export type Contact = typeof contacts.$inferSelect
export type NewContact = typeof contacts.$inferInsert
export type LifecycleStage = Contact["lifecycleStage"]
export type ContactSource = Contact["source"]
export type Tag = typeof tags.$inferSelect
