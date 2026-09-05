/**
 * Contact reads.
 *
 * Pagination, search and filtering all happen in SQL. With 2,500 contacts
 * today and 500 arriving a month, loading the table into memory to filter it
 * would stop working within the year — and the list page is the most-used
 * screen in the app.
 */

import { and, asc, count, desc, eq, ilike, isNull, or, sql } from "drizzle-orm"

import { db } from "@/db"
import { contactTags, contacts, tags } from "@/db/schema"
import type { ContactListParams } from "@/lib/validation/contact"

export type ContactListRow = {
  id: string
  fullName: string
  phoneE164: string
  email: string | null
  city: string | null
  lifecycleStage: (typeof contacts.$inferSelect)["lifecycleStage"]
  source: (typeof contacts.$inferSelect)["source"]
  createdAt: Date
}

export async function listContacts(params: ContactListParams): Promise<{
  rows: ContactListRow[]
  total: number
}> {
  const { q, stage, source, tag, page, perPage, sort, dir } = params

  const filters = [isNull(contacts.deletedAt)]

  if (q) {
    const term = `%${q}%`
    // Phone search has to work on what the user typed as well as the stored
    // canonical form, so match both columns plus a digits-only comparison.
    const digits = q.replace(/\D/g, "")
    const clauses = [
      ilike(contacts.fullName, term),
      ilike(contacts.email, term),
      ilike(contacts.phoneE164, term),
      ilike(contacts.phoneRaw, term),
    ]
    if (digits.length >= 4) {
      clauses.push(sql`regexp_replace(${contacts.phoneE164}, '\\D', '', 'g') like ${`%${digits}%`}`)
    }
    filters.push(or(...clauses)!)
  }

  if (stage) filters.push(eq(contacts.lifecycleStage, stage))
  if (source) filters.push(eq(contacts.source, source))

  if (tag) {
    filters.push(
      sql`exists (
        select 1 from ${contactTags}
        where ${contactTags.contactId} = ${contacts.id}
          and ${contactTags.tagId} = ${tag}::uuid
      )`
    )
  }

  const where = and(...filters)

  const sortColumn =
    sort === "fullName"
      ? contacts.fullName
      : sort === "lifecycleStage"
        ? contacts.lifecycleStage
        : contacts.createdAt

  const orderBy = dir === "asc" ? asc(sortColumn) : desc(sortColumn)

  const [rows, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: contacts.id,
        fullName: contacts.fullName,
        phoneE164: contacts.phoneE164,
        email: contacts.email,
        city: contacts.city,
        lifecycleStage: contacts.lifecycleStage,
        source: contacts.source,
        createdAt: contacts.createdAt,
      })
      .from(contacts)
      .where(where)
      .orderBy(orderBy)
      .limit(perPage)
      .offset((page - 1) * perPage),

    db.select({ value: count() }).from(contacts).where(where),
  ])

  return { rows, total }
}

export async function getContact(id: string) {
  const [row] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, id), isNull(contacts.deletedAt)))
    .limit(1)

  return row ?? null
}

/** Is this number already taken by a LIVE contact? Powers the friendly duplicate error. */
export async function findContactByPhone(phoneE164: string, excludeId?: string) {
  const filters = [eq(contacts.phoneE164, phoneE164), isNull(contacts.deletedAt)]
  const [row] = await db
    .select({ id: contacts.id, fullName: contacts.fullName })
    .from(contacts)
    .where(and(...filters))
    .limit(1)

  if (!row) return null
  if (excludeId && row.id === excludeId) return null
  return row
}

export async function listAllTags() {
  return db.select().from(tags).orderBy(asc(tags.name))
}

export async function getContactTags(contactId: string) {
  return db
    .select({ id: tags.id, name: tags.name, colour: tags.colour })
    .from(contactTags)
    .innerJoin(tags, eq(tags.id, contactTags.tagId))
    .where(eq(contactTags.contactId, contactId))
    .orderBy(asc(tags.name))
}

/** Lightweight picker source for enrollment forms. */
export async function searchContactsForPicker(q: string, limit = 20) {
  const filters = [isNull(contacts.deletedAt)]
  if (q) {
    const term = `%${q}%`
    filters.push(or(ilike(contacts.fullName, term), ilike(contacts.phoneE164, term))!)
  }

  return db
    .select({
      id: contacts.id,
      fullName: contacts.fullName,
      phoneE164: contacts.phoneE164,
    })
    .from(contacts)
    .where(and(...filters))
    .orderBy(asc(contacts.fullName))
    .limit(limit)
}
