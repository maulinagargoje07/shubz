"use server"

/**
 * Creating a whole student record in one go.
 *
 * Contact, enrollment, schedule and opening payment are written in a SINGLE
 * transaction. That matters for money: a record that created the enrollment
 * but failed on the payment would show the student as owing the full fee they
 * had just handed over. Either the whole record exists or none of it does.
 */

import { revalidateEverything } from "@/lib/revalidate"
import { and, eq, isNull } from "drizzle-orm"

import { contacts, enrollments, paymentSchedule, payments, programs } from "@/db/schema"
import { db } from "@/db"
import { mutate } from "@/lib/audit"
import { newId } from "@/lib/ids"
import { parsePhone } from "@/lib/phone"
import { requireUser } from "@/lib/session"
import { studentRecordEditSchema, studentRecordSchema } from "@/lib/validation/record"
import type { ActionResult } from "@/lib/validation/shared"
import { nextReceiptNo, reconcileSchedule } from "@/server/payments/ledger"
import { resolveBatch, resolveProgram } from "./resolve"

function fieldErrorsOf(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "")
    if (key && !out[key]) out[key] = issue.message
  }
  return out
}

export async function createStudentRecord(input: unknown): Promise<
  ActionResult<{
    enrollmentId: string
    contactId: string
    reusedContact: boolean
    receiptNo: string | null
  }>
> {
  const user = await requireUser()

  const parsed = studentRecordSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsOf(parsed.error),
    }
  }

  const values = parsed.data

  // The authoritative parse. The shared schema only checked the shape, so this
  // is where the number becomes the canonical E.164 the unique index is on.
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

  const netPayable = values.totalFeesRupees
  const openingPayment = values.feesPaidRupees

  try {
    const result = await mutate(user, async ({ tx, audit }) => {
      // ---- the student ----
      // An existing contact is reused rather than rejected. Someone enrolling
      // in a second program is the same person, and blocking that would push
      // the user back into the multi-screen flow this form exists to replace.
      const [existing] = await tx
        .select({ id: contacts.id, fullName: contacts.fullName })
        .from(contacts)
        .where(and(eq(contacts.phoneE164, phone.e164), isNull(contacts.deletedAt)))
        .limit(1)

      let contactId: string
      const reusedContact = Boolean(existing)

      if (existing) {
        contactId = existing.id
        // Enrolling someone makes them a student, whatever they were before.
        const [after] = await tx
          .update(contacts)
          .set({
            lifecycleStage: "STUDENT",
            email: values.email ?? undefined,
            city: values.city ?? undefined,
            updatedAt: new Date(),
          })
          .where(eq(contacts.id, contactId))
          .returning()

        await audit({
          action: "UPDATE",
          entity: "contacts",
          entityId: contactId,
          after,
        })
      } else {
        const [created] = await tx
          .insert(contacts)
          .values({
            id: newId(),
            fullName: values.fullName,
            phoneE164: phone.e164,
            phoneRaw: phone.raw,
            email: values.email,
            city: values.city,
            lifecycleStage: "STUDENT",
            source: "WALK_IN",
            createdBy: user.id,
          })
          .returning()

        contactId = created.id
        await audit({
          action: "CREATE",
          entity: "contacts",
          entityId: contactId,
          after: created,
        })
      }

      // ---- catalogue ----
      const program = await resolveProgram(tx, values.programKind, user.id)

      const [programRow] = await tx
        .select({ code: programs.code })
        .from(programs)
        .where(eq(programs.id, program.id))
        .limit(1)

      const batchId = values.batchLabel
        ? await resolveBatch(tx, program.id, programRow?.code ?? "BATCH", values.batchLabel)
        : null

      // ---- the enrollment ----
      const [enrollment] = await tx
        .insert(enrollments)
        .values({
          id: newId(),
          contactId,
          programId: program.id,
          batchId,
          status: "ACTIVE",
          enrolledOn: values.enrolledOn,
          startDate: values.enrolledOn,
          feeTotalPaise: values.totalFeesRupees,
          discountPaise: 0,
          // The quick form's mental model is a single total, so the record is
          // one-time. Recurring memberships still go through the full form.
          billingType: "ONE_TIME",
          billingCycle: null,
          source: "WALK_IN",
          notes: values.notes,
          createdBy: user.id,
        })
        .returning()

      await audit({
        action: "CREATE",
        entity: "enrollments",
        entityId: enrollment.id,
        after: enrollment,
      })

      // One schedule row for the whole fee, due on the enrolment date. This
      // keeps the record inside the same overdue rule as every other
      // enrollment — an unpaid row past its due date — so an unpaid balance
      // surfaces on the fees dashboard rather than sitting invisible.
      if (netPayable > 0) {
        await tx.insert(paymentSchedule).values({
          id: newId(),
          enrollmentId: enrollment.id,
          seq: 1,
          dueDate: values.enrolledOn,
          amountPaise: netPayable,
          status: "PENDING",
        })
      }

      // ---- the opening payment ----
      let receiptNo: string | null = null

      if (openingPayment > 0) {
        receiptNo = await nextReceiptNo(tx, values.enrolledOn)

        const [payment] = await tx
          .insert(payments)
          .values({
            id: newId(),
            enrollmentId: enrollment.id,
            amountPaise: openingPayment,
            paidOn: values.enrolledOn,
            method: values.paymentMethod,
            referenceNo: values.paymentReference,
            receiptNo,
            recordedByUserId: user.id,
          })
          .returning()

        await audit({
          action: "PAYMENT_RECORDED",
          entity: "payments",
          entityId: payment.id,
          after: payment,
        })
      }

      // Derives the schedule status and next_due_date from what was just
      // written, so outstanding is correct the moment the page reloads.
      await reconcileSchedule(tx, enrollment.id)

      return { enrollmentId: enrollment.id, contactId, reusedContact, receiptNo }
    })

  revalidateEverything()

    return { ok: true, data: result }
  } catch (error) {
    // A duplicate here means this contact is already enrolled in this batch.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "23505"
    ) {
      return {
        ok: false,
        error: "This student is already enrolled in that batch.",
        fieldErrors: { batchLabel: "Already enrolled in this batch" },
      }
    }
    throw error
  }
}


/**
 * Edit an existing record.
 *
 * Changing the total fee resizes the single schedule row the quick form
 * created, so outstanding follows immediately. An enrollment with a real
 * installment plan (more than one row) is left alone — resizing one of several
 * instalments is ambiguous, and that case belongs to the detailed form.
 */
export async function updateStudentRecord(
  input: unknown
): Promise<ActionResult<{ enrollmentId: string }>> {
  const user = await requireUser()

  const parsed = studentRecordEditSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsOf(parsed.error),
    }
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

  const before = await db.query.enrollments.findFirst({
    where: and(eq(enrollments.id, values.id), isNull(enrollments.deletedAt)),
  })
  if (!before) return { ok: false, error: "That record no longer exists." }

  // The phone must stay unique among live contacts, and this contact may be
  // shared with other enrollments.
  const [clash] = await db
    .select({ id: contacts.id, fullName: contacts.fullName })
    .from(contacts)
    .where(and(eq(contacts.phoneE164, phone.e164), isNull(contacts.deletedAt)))
    .limit(1)

  if (clash && clash.id !== before.contactId) {
    return {
      ok: false,
      error: "That phone number belongs to another student.",
      fieldErrors: { phone: `${clash.fullName} already has this number.` },
    }
  }

  try {
    await mutate(user, async ({ tx, audit }) => {
      const [contactAfter] = await tx
        .update(contacts)
        .set({
          fullName: values.fullName,
          phoneE164: phone.e164,
          phoneRaw: phone.raw,
          email: values.email,
          city: values.city,
          updatedAt: new Date(),
        })
        .where(eq(contacts.id, before.contactId))
        .returning()

      await audit({
        action: "UPDATE",
        entity: "contacts",
        entityId: before.contactId,
        after: contactAfter,
      })

      const program = await resolveProgram(tx, values.programKind, user.id)
      const [pc] = await tx
        .select({ code: programs.code })
        .from(programs)
        .where(eq(programs.id, program.id))
        .limit(1)

      const batchId = values.batchLabel
        ? await resolveBatch(tx, program.id, pc?.code ?? "BATCH", values.batchLabel)
        : null

      const [after] = await tx
        .update(enrollments)
        .set({
          programId: program.id,
          batchId,
          status: values.status,
          enrolledOn: values.enrolledOn,
          startDate: values.enrolledOn,
          feeTotalPaise: values.totalFeesRupees,
          notes: values.notes,
          updatedAt: new Date(),
        })
        .where(eq(enrollments.id, values.id))
        .returning()

      // Resize the schedule so outstanding tracks the new fee.
      const rows = await tx
        .select({ id: paymentSchedule.id })
        .from(paymentSchedule)
        .where(eq(paymentSchedule.enrollmentId, values.id))

      if (rows.length === 1) {
        await tx
          .update(paymentSchedule)
          .set({
            amountPaise: values.totalFeesRupees,
            dueDate: values.enrolledOn,
            updatedAt: new Date(),
          })
          .where(eq(paymentSchedule.id, rows[0].id))
      } else if (rows.length === 0 && values.totalFeesRupees > 0) {
        await tx.insert(paymentSchedule).values({
          id: newId(),
          enrollmentId: values.id,
          seq: 1,
          dueDate: values.enrolledOn,
          amountPaise: values.totalFeesRupees,
          status: "PENDING",
        })
      }

      await reconcileSchedule(tx, values.id)

      await audit({
        action: "UPDATE",
        entity: "enrollments",
        entityId: values.id,
        before,
        after,
      })
    })
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "23505"
    ) {
      return {
        ok: false,
        error: "This student is already enrolled in that batch.",
        fieldErrors: { batchLabel: "Already enrolled in this batch" },
      }
    }
    throw error
  }

  revalidateEverything()
  return { ok: true, data: { enrollmentId: values.id } }
}
