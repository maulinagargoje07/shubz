import { and, desc, eq } from "drizzle-orm"

import { db } from "@/db"
import { auditLog, consentEvents, notes, users } from "@/db/schema"

/** Notes on a contact, newest first. */
export async function listNotesForContact(contactId: string) {
  return db
    .select({
      id: notes.id,
      body: notes.body,
      createdAt: notes.createdAt,
      authorName: users.name,
    })
    .from(notes)
    .leftJoin(users, eq(users.id, notes.createdBy))
    .where(eq(notes.contactId, contactId))
    .orderBy(desc(notes.createdAt))
}

/**
 * Consent, DERIVED as the latest event per channel. There is no boolean
 * column — the event log is the record, and this is the current reading of it.
 */
export async function currentConsent(contactId: string) {
  const events = await db
    .select()
    .from(consentEvents)
    .where(eq(consentEvents.contactId, contactId))
    .orderBy(desc(consentEvents.occurredAt))

  const latest = new Map<string, (typeof events)[number]>()
  for (const event of events) {
    if (!latest.has(event.channel)) latest.set(event.channel, event)
  }

  return Array.from(latest.values())
}

/** Everything that happened to this contact, for the Activity tab. */
export async function listActivityForContact(contactId: string, limit = 50) {
  return db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      entity: auditLog.entity,
      entityId: auditLog.entityId,
      before: auditLog.before,
      after: auditLog.after,
      createdAt: auditLog.createdAt,
      actorName: users.name,
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorUserId))
    .where(and(eq(auditLog.entity, "contacts"), eq(auditLog.entityId, contactId)))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit)
}
