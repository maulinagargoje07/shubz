"use server"

/**
 * Contact mutations.
 *
 * Shape of every action here: parse with the shared zod schema, authorise,
 * run inside one transaction with the audit row, revalidate.
 *
 * Duplicate phone numbers are checked explicitly before insert so the user
 * gets "Ravi Kumar already has this number" on the phone field rather than a
 * raw unique-constraint stack trace. The constraint is still the authority —
 * the check is a race away from being stale, so the insert is wrapped and a
 * constraint violation is translated to the same friendly message.
 */

import { revalidatePath } from "next/cache"
import { and, eq, isNull } from "drizzle-orm"

import { db } from "@/db"
import { consentEvents, contacts, notes } from "@/db/schema"
import { mutate } from "@/lib/audit"
import { newId } from "@/lib/ids"
import { parsePhone } from "@/lib/phone"
import { requireUser } from "@/lib/session"
import type { ActionResult } from "@/lib/validation/shared"
import {
  consentSchema,
  contactFormSchema,
  noteSchema,
  updateContactSchema,
} from "@/lib/validation/contact"
import { findContactByPhone } from "./queries"

/** Postgres unique-violation SQLSTATE. */
const UNIQUE_VIOLATION = "23505"

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === UNIQUE_VIOLATION
  )
}

export async function createContact(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser()

  const parsed = contactFormSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsOf(parsed.error) }
  }

  const values = parsed.data
  // phoneSchema already normalised this; re-derive raw for the audit trail.
  const rawPhone = typeof (input as { phone?: unknown })?.phone === "string"
    ? ((input as { phone: string }).phone).trim()
    : values.phone

  const existing = await findContactByPhone(values.phone)
  if (existing) {
    return {
      ok: false,
      error: "That phone number is already on file.",
      fieldErrors: { phone: `${existing.fullName} already has this number.` },
    }
  }

  try {
    const id = await mutate(user, async ({ tx, audit }) => {
      const [row] = await tx
        .insert(contacts)
        .values({
          id: newId(),
          fullName: values.fullName,
          phoneE164: values.phone,
          phoneRaw: rawPhone,
          altPhone: values.altPhone,
          email: values.email,
          city: values.city,
          state: values.state,
          lifecycleStage: values.lifecycleStage,
          source: values.source,
          telegramUsername: values.telegramUsername,
          tradingviewUsername: values.tradingviewUsername,
          notes: values.notes,
          createdBy: user.id,
        })
        .returning()

      await audit({ action: "CREATE", entity: "contacts", entityId: row.id, after: row })
      return row.id
    })

    revalidatePath("/contacts")
    return { ok: true, data: { id } }
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        ok: false,
        error: "That phone number is already on file.",
        fieldErrors: { phone: "Another contact already has this number." },
      }
    }
    throw error
  }
}

export async function updateContact(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser()

  const parsed = updateContactSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsOf(parsed.error) }
  }

  const values = parsed.data

  const clash = await findContactByPhone(values.phone, values.id)
  if (clash) {
    return {
      ok: false,
      error: "That phone number is already on file.",
      fieldErrors: { phone: `${clash.fullName} already has this number.` },
    }
  }

  const before = await db.query.contacts.findFirst({
    where: and(eq(contacts.id, values.id), isNull(contacts.deletedAt)),
  })
  if (!before) return { ok: false, error: "That contact no longer exists." }

  const rawPhone = typeof (input as { phone?: unknown })?.phone === "string"
    ? ((input as { phone: string }).phone).trim()
    : values.phone

  try {
    await mutate(user, async ({ tx, audit }) => {
      const [after] = await tx
        .update(contacts)
        .set({
          fullName: values.fullName,
          phoneE164: values.phone,
          phoneRaw: rawPhone,
          altPhone: values.altPhone,
          email: values.email,
          city: values.city,
          state: values.state,
          lifecycleStage: values.lifecycleStage,
          source: values.source,
          telegramUsername: values.telegramUsername,
          tradingviewUsername: values.tradingviewUsername,
          notes: values.notes,
          updatedAt: new Date(),
        })
        .where(eq(contacts.id, values.id))
        .returning()

      await audit({
        action: "UPDATE",
        entity: "contacts",
        entityId: values.id,
        before,
        after,
      })
    })
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        ok: false,
        error: "That phone number is already on file.",
        fieldErrors: { phone: "Another contact already has this number." },
      }
    }
    throw error
  }

  revalidatePath("/contacts")
  revalidatePath(`/contacts/${values.id}`)
  return { ok: true, data: { id: values.id } }
}

/**
 * Soft delete. The row stays for history; the partial unique index means the
 * phone number is released so the person can be re-added later.
 */
export async function deleteContact(id: string): Promise<ActionResult> {
  const user = await requireUser()

  const before = await db.query.contacts.findFirst({
    where: and(eq(contacts.id, id), isNull(contacts.deletedAt)),
  })
  if (!before) return { ok: false, error: "That contact no longer exists." }

  await mutate(user, async ({ tx, audit }) => {
    const [after] = await tx
      .update(contacts)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(contacts.id, id))
      .returning()

    await audit({ action: "DELETE", entity: "contacts", entityId: id, before, after })
  })

  revalidatePath("/contacts")
  return { ok: true, data: undefined }
}

export async function addNote(input: unknown): Promise<ActionResult> {
  const user = await requireUser()

  const parsed = noteSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: "Write something first." }
  }

  const values = parsed.data

  await mutate(user, async ({ tx, audit }) => {
    const [row] = await tx
      .insert(notes)
      .values({
        id: newId(),
        contactId: values.contactId ?? null,
        enrollmentId: values.enrollmentId ?? null,
        body: values.body,
        createdBy: user.id,
      })
      .returning()

    await audit({ action: "CREATE", entity: "notes", entityId: row.id, after: row })
  })

  if (values.contactId) revalidatePath(`/contacts/${values.contactId}`)
  return { ok: true, data: undefined }
}

/**
 * Consent is append-only. Recording an opt-out does not erase the earlier
 * opt-in — the pair is the evidence of what was agreed and when.
 */
export async function recordConsent(input: unknown): Promise<ActionResult> {
  const user = await requireUser()

  const parsed = consentSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Could not record that consent event." }

  const values = parsed.data

  await mutate(user, async ({ tx, audit }) => {
    const [row] = await tx
      .insert(consentEvents)
      .values({
        id: newId(),
        contactId: values.contactId,
        channel: values.channel,
        action: values.action,
        consentText: values.consentText,
        source: values.source,
        occurredAt: values.occurredAt ? new Date(`${values.occurredAt}T00:00:00+05:30`) : new Date(),
        recordedBy: user.id,
      })
      .returning()

    await audit({
      action: "CONSENT_RECORDED",
      entity: "consent_events",
      entityId: row.id,
      after: row,
    })
  })

  revalidatePath(`/contacts/${values.contactId}`)
  return { ok: true, data: undefined }
}

function fieldErrorsOf(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "")
    if (key && !out[key]) out[key] = issue.message
  }
  return out
}
