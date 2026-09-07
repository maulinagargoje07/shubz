"use server"

import { eq, inArray } from "drizzle-orm"
import { z } from "zod"

import { type DbTx } from "@/db"
import { auditLog, contactTags, contacts, tags } from "@/db/schema"
import { mutate } from "@/lib/audit"
import { newId } from "@/lib/ids"
import { LEAD_STATUSES } from "@/lib/leads"
import { revalidateEverything } from "@/lib/revalidate"
import { checkPermission } from "@/lib/session"
import { uuidSchema, type ActionResult } from "@/lib/validation/shared"
import { leadIdsMatching, type LeadFilters } from "./queries"

const leadStatusSchema = z.enum(LEAD_STATUSES)

const setStatusSchema = z.object({
  contactId: uuidSchema,
  status: leadStatusSchema,
})

/** Move one lead along the pipeline. */
export async function setLeadStatus(input: unknown): Promise<ActionResult<null>> {
  const gate = await checkPermission("MANAGE_CONTACTS")
  if (!gate.ok) return gate

  const parsed = setStatusSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "That status is not valid." }

  const { contactId, status } = parsed.data

  await mutate(gate.user, async ({ tx, audit }) => {
    const [before] = await tx
      .select({ status: contacts.leadStatus })
      .from(contacts)
      .where(eq(contacts.id, contactId))

    await tx
      .update(contacts)
      .set({ leadStatus: status, updatedAt: new Date() })
      .where(eq(contacts.id, contactId))

    await audit({
      action: "LEAD_STATUS_CHANGED",
      entity: "contacts",
      entityId: contactId,
      before: { leadStatus: before?.status ?? null },
      after: { leadStatus: status },
    })
  })

  revalidateEverything()
  return { ok: true, data: null }
}

/**
 * The filters a bulk action applies to.
 *
 * Bulk work here is expressed as "everyone matching what is on screen" rather
 * than a list of ticked boxes. That is the shape the job actually takes —
 * "mark this whole webinar list as contacted" — it survives pagination, which
 * a checkbox selection does not, and it is the same selection a campaign will
 * later need to send to.
 */
const filtersSchema = z.object({
  q: z.string().trim().optional(),
  status: leadStatusSchema.optional(),
  source: z.string().trim().optional(),
  list: uuidSchema.optional(),
  experience: z.string().trim().optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  includeConverted: z.boolean().optional(),
})

const bulkStatusSchema = z.object({
  filters: filtersSchema,
  status: leadStatusSchema,
  /**
   * How many rows the person was looking at when they pressed the button. If
   * the real count has moved since the page rendered, the action stops instead
   * of quietly updating a different set than the one on screen.
   */
  expectedCount: z.number().int().min(0),
})

export async function bulkSetLeadStatus(
  input: unknown
): Promise<ActionResult<{ updated: number }>> {
  const gate = await checkPermission("MANAGE_CONTACTS")
  if (!gate.ok) return gate

  const parsed = bulkStatusSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Could not read that request." }

  const { filters, status, expectedCount } = parsed.data
  const ids = await leadIdsMatching(filters as LeadFilters)

  if (ids.length === 0) return { ok: false, error: "No leads match those filters." }
  if (ids.length !== expectedCount) {
    return {
      ok: false,
      error: `This now matches ${ids.length} leads, not ${expectedCount}. Reload and try again.`,
    }
  }

  await mutate(gate.user, async ({ tx }) => {
    await tx
      .update(contacts)
      .set({ leadStatus: status, updatedAt: new Date() })
      .where(inArray(contacts.id, ids))

    /*
     * One audit row per lead rather than a single row describing the batch.
     * A batch row cannot be found by entity id, so "what happened to this
     * person" — the question the contact's Activity tab answers — would have
     * a hole in it wherever a bulk action had been used. Written in chunks so
     * this stays a handful of statements rather than one per lead.
     */
    await writeBulkAudit(tx, gate.user.id, ids, "LEADS_BULK_STATUS", {
      leadStatus: status,
      viaFilters: filters,
    })
  })

  revalidateEverything()
  return { ok: true, data: { updated: ids.length } }
}

const bulkTagSchema = z.object({
  filters: filtersSchema,
  listName: z.string().trim().min(1, "Give the list a name").max(60),
  expectedCount: z.number().int().min(0),
})

/**
 * Put every matching lead into a named list.
 *
 * This is how a segment gets built for messaging: filter the pipeline down to
 * who should hear from you, then name that group once. The tag is reused if it
 * already exists, so adding to a list across several imports works.
 */
export async function bulkTagLeads(
  input: unknown
): Promise<ActionResult<{ tagged: number; listName: string }>> {
  const gate = await checkPermission("MANAGE_CONTACTS")
  if (!gate.ok) return gate

  const parsed = bulkTagSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Could not read that request.",
    }
  }

  const { filters, listName, expectedCount } = parsed.data
  const ids = await leadIdsMatching(filters as LeadFilters)

  if (ids.length === 0) return { ok: false, error: "No leads match those filters." }
  if (ids.length !== expectedCount) {
    return {
      ok: false,
      error: `This now matches ${ids.length} leads, not ${expectedCount}. Reload and try again.`,
    }
  }

  await mutate(gate.user, async ({ tx }) => {
    await tx
      .insert(tags)
      .values({ id: newId(), name: listName, colour: "#7c3aed" })
      .onConflictDoNothing()
    const [tag] = await tx.select({ id: tags.id }).from(tags).where(eq(tags.name, listName))
    if (!tag) throw new Error("Could not create that list")

    // Chunked: a single insert of every id is one enormous statement once a
    // list runs to thousands, and Postgres has a parameter ceiling.
    for (let i = 0; i < ids.length; i += 500) {
      await tx
        .insert(contactTags)
        .values(ids.slice(i, i + 500).map((id) => ({ contactId: id, tagId: tag.id })))
        .onConflictDoNothing()
    }

    await writeBulkAudit(tx, gate.user.id, ids, "LEADS_BULK_TAGGED", {
      addedToList: listName,
      viaFilters: filters,
    })
  })

  revalidateEverything()
  return { ok: true, data: { tagged: ids.length, listName } }
}

/**
 * Audit a change that touched many contacts at once.
 *
 * Chunked to keep the statement count low while still leaving every affected
 * contact its own row, so the Activity tab on a lead shows bulk changes the
 * same way it shows individual ones.
 */
async function writeBulkAudit(
  tx: DbTx,
  actorUserId: string,
  contactIds: string[],
  action: string,
  after: Record<string, unknown>
): Promise<void> {
  for (let i = 0; i < contactIds.length; i += 500) {
    await tx.insert(auditLog).values(
      contactIds.slice(i, i + 500).map((id) => ({
        id: newId(),
        actorUserId,
        action,
        entity: "contacts",
        entityId: id,
        after,
      }))
    )
  }
}
