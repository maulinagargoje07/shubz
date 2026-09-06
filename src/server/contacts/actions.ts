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
 *
 * Phone normalisation happens HERE, not in the shared zod schema. The schema
 * only checks the shape, so that client bundles stay clear of
 * libphonenumber-js; this is the single point where a number becomes canonical
 * E.164 on its way to the database.
 */

import { revalidateEverything } from "@/lib/revalidate"
import { and, eq, isNull } from "drizzle-orm"

import { db } from "@/db"
import { consentEvents, contacts, enrollments, notes, payments } from "@/db/schema"
import { mutate } from "@/lib/audit"
import { newId } from "@/lib/ids"
import { parsePhone, tryParsePhone } from "@/lib/phone"
import { checkPermission } from "@/lib/session"
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
  const gate = await checkPermission("MANAGE_CONTACTS")
  if (!gate.ok) return gate
  const user = gate.user

  const parsed = contactFormSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsOf(parsed.error) }
  }

  const values = parsed.data

  // The authoritative parse. Rejects anything libphonenumber will not accept,
  // and yields the one canonical form the unique index is built on.
  let phone
  try {
    phone = parsePhone(values.phone)
  } catch (error) {
    return {
      ok: false,
      error: "That phone number is not valid.",
      fieldErrors: {
        phone: error instanceof Error ? error.message : "Not a valid phone number",
      },
    }
  }

  const altPhone = values.altPhone ? tryParsePhone(values.altPhone)?.e164 ?? null : null
  if (values.altPhone && !altPhone) {
    return {
      ok: false,
      error: "That alternate phone number is not valid.",
      fieldErrors: { altPhone: "Not a valid phone number" },
    }
  }

  const existing = await findContactByPhone(phone.e164)
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
          phoneE164: phone.e164,
          phoneRaw: phone.raw,
          altPhone,
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

  revalidateEverything()
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
  const gate = await checkPermission("MANAGE_CONTACTS")
  if (!gate.ok) return gate
  const user = gate.user

  const parsed = updateContactSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsOf(parsed.error) }
  }

  const values = parsed.data

  let phone
  try {
    phone = parsePhone(values.phone)
  } catch (error) {
    return {
      ok: false,
      error: "That phone number is not valid.",
      fieldErrors: {
        phone: error instanceof Error ? error.message : "Not a valid phone number",
      },
    }
  }

  const altPhone = values.altPhone ? tryParsePhone(values.altPhone)?.e164 ?? null : null
  if (values.altPhone && !altPhone) {
    return {
      ok: false,
      error: "That alternate phone number is not valid.",
      fieldErrors: { altPhone: "Not a valid phone number" },
    }
  }

  const clash = await findContactByPhone(phone.e164, values.id)
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

  try {
    await mutate(user, async ({ tx, audit }) => {
      const [after] = await tx
        .update(contacts)
        .set({
          fullName: values.fullName,
          phoneE164: phone.e164,
          phoneRaw: phone.raw,
          altPhone,
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

  revalidateEverything()
  return { ok: true, data: { id: values.id } }
}

/**
 * Soft-delete a contact, and everything hanging off them.
 *
 * The cascade matters. Enrollment and payment queries join contacts without
 * filtering on the contact's own `deleted_at`, so a contact removed on their
 * own would vanish from the contacts list while their enrollments carried on
 * appearing in Records, and their payments carried on counting toward
 * collected revenue. Deleting a person has to mean deleting their records.
 *
 * Nothing is destroyed — every row keeps its data and receipt numbers, the
 * cascade is written to the audit log, and clearing `deleted_at` restores it.
 * The partial unique index also releases the phone number, so the same person
 * can be re-added later.
 */
export async function deleteContact(id: string): Promise<ActionResult> {
  const gate = await checkPermission("DELETE_RECORDS")
  if (!gate.ok) return gate
  const user = gate.user

  const before = await db.query.contacts.findFirst({
    where: and(eq(contacts.id, id), isNull(contacts.deletedAt)),
  })
  if (!before) return { ok: false, error: "That contact no longer exists." }

  await mutate(user, async ({ tx, audit }) => {
    const deletedAt = new Date()

    const liveEnrollments = await tx
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(and(eq(enrollments.contactId, id), isNull(enrollments.deletedAt)))

    for (const enrollment of liveEnrollments) {
      const voided = await tx
        .update(payments)
        .set({ deletedAt })
        .where(and(eq(payments.enrollmentId, enrollment.id), isNull(payments.deletedAt)))
        .returning({ id: payments.id })

      for (const payment of voided) {
        await audit({
          action: "PAYMENT_VOIDED",
          entity: "payments",
          entityId: payment.id,
          after: { reason: "Contact deleted" },
        })
      }

      await tx
        .update(enrollments)
        .set({ deletedAt, updatedAt: new Date() })
        .where(eq(enrollments.id, enrollment.id))

      await audit({
        action: "DELETE",
        entity: "enrollments",
        entityId: enrollment.id,
        after: { reason: "Contact deleted" },
      })
    }

    const [after] = await tx
      .update(contacts)
      .set({ deletedAt, updatedAt: new Date() })
      .where(eq(contacts.id, id))
      .returning()

    await audit({
      action: "DELETE",
      entity: "contacts",
      entityId: id,
      before,
      after: { ...after, cascadedEnrollments: liveEnrollments.length },
    })
  })

  revalidateEverything()
  return { ok: true, data: undefined }
}

export async function addNote(input: unknown): Promise<ActionResult> {
  const gate = await checkPermission("MANAGE_CONTACTS")
  if (!gate.ok) return gate
  const user = gate.user

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

  if (values.contactId)  revalidateEverything()
  return { ok: true, data: undefined }
}

/**
 * Consent is append-only. Recording an opt-out does not erase the earlier
 * opt-in — the pair is the evidence of what was agreed and when.
 */
export async function recordConsent(input: unknown): Promise<ActionResult> {
  const gate = await checkPermission("MANAGE_CONTACTS")
  if (!gate.ok) return gate
  const user = gate.user

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

  revalidateEverything()
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
