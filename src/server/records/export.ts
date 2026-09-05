/**
 * The enrollment records export.
 *
 * Two decisions that matter for a file destined for Excel:
 *
 * 1. Money is written as a PLAIN NUMBER (45000.00), not "₹45,000.00". Excel
 *    reads a currency-formatted string as text, so a column of them cannot be
 *    summed — which is the first thing anyone does with a fees export.
 *
 * 2. The file is prefixed with a UTF-8 BOM and uses CRLF. Without the BOM,
 *    Excel on Windows mis-decodes non-ASCII names; without CRLF it can treat
 *    the whole file as one row.
 */

import { and, desc, eq, isNull, sql } from "drizzle-orm"

import { db } from "@/db"
import { enrollmentBalances } from "@/db/views"
import { batches, contacts, enrollments, programs } from "@/db/schema"
import { deliveryModeLabel, programTypeLabel } from "@/lib/programs"

export type ExportFilters = {
  programId?: string
  status?: string
  overdueOnly?: boolean
}

export async function listEnrollmentRecords(filters: ExportFilters = {}) {
  const conditions = [isNull(enrollments.deletedAt)]
  if (filters.programId) conditions.push(eq(enrollments.programId, filters.programId))
  if (filters.status) conditions.push(sql`${enrollments.status} = ${filters.status}`)
  if (filters.overdueOnly) conditions.push(eq(enrollmentBalances.isOverdue, true))

  return db
    .select({
      enrolledOn: enrollments.enrolledOn,
      contactName: contacts.fullName,
      phone: contacts.phoneE164,
      email: contacts.email,
      city: contacts.city,
      programName: programs.name,
      programType: programs.type,
      deliveryMode: programs.deliveryMode,
      batchName: batches.name,
      seatNumber: enrollments.seatNumber,
      status: enrollments.status,
      feeTotalPaise: enrollments.feeTotalPaise,
      discountPaise: enrollments.discountPaise,
      netPayablePaise: enrollmentBalances.netPayablePaise,
      totalPaidPaise: enrollmentBalances.totalPaidPaise,
      balanceDuePaise: enrollmentBalances.balanceDuePaise,
      isOverdue: enrollmentBalances.isOverdue,
      daysOverdue: enrollmentBalances.daysOverdue,
      nextDueDate: enrollmentBalances.nextDueDate,
      notes: enrollments.notes,
    })
    .from(enrollments)
    .innerJoin(contacts, eq(contacts.id, enrollments.contactId))
    .innerJoin(programs, eq(programs.id, enrollments.programId))
    .leftJoin(batches, eq(batches.id, enrollments.batchId))
    .innerJoin(enrollmentBalances, eq(enrollmentBalances.enrollmentId, enrollments.id))
    .where(and(...conditions))
    .orderBy(desc(enrollments.enrolledOn), contacts.fullName)
}

type Row = Awaited<ReturnType<typeof listEnrollmentRecords>>[number]

/** Paise to a plain decimal string Excel will treat as a number. */
function rupees(paise: number | string | null | undefined): string {
  const n = Number(paise ?? 0)
  if (!Number.isFinite(n)) return "0.00"
  return (n / 100).toFixed(2)
}

/**
 * RFC 4180 escaping. A field containing a comma, quote or newline is wrapped
 * in quotes with inner quotes doubled — student notes routinely contain all
 * three.
 */
function cell(value: unknown): string {
  if (value === null || value === undefined) return ""
  const text = String(value)
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

const COLUMNS: { header: string; value: (row: Row) => unknown }[] = [
  { header: "Date", value: (r) => r.enrolledOn },
  { header: "Student", value: (r) => r.contactName },
  // Leading apostrophe stops Excel dropping the + and reading it as a formula.
  { header: "Phone", value: (r) => `'${r.phone}` },
  { header: "Email", value: (r) => r.email },
  { header: "City", value: (r) => r.city },
  { header: "Program", value: (r) => programTypeLabel(r.programType) },
  { header: "Mode", value: (r) => deliveryModeLabel(r.deliveryMode) },
  { header: "Program name", value: (r) => r.programName },
  { header: "Batch", value: (r) => r.batchName },
  { header: "Seat", value: (r) => r.seatNumber },
  { header: "Total fees", value: (r) => rupees(r.feeTotalPaise) },
  { header: "Discount", value: (r) => rupees(r.discountPaise) },
  { header: "Net payable", value: (r) => rupees(r.netPayablePaise) },
  { header: "Fees paid", value: (r) => rupees(r.totalPaidPaise) },
  {
    header: "Outstanding",
    value: (r) => rupees(Math.max(Number(r.balanceDuePaise ?? 0), 0)),
  },
  { header: "Status", value: (r) => r.status },
  { header: "Overdue", value: (r) => (r.isOverdue ? "Yes" : "No") },
  { header: "Days overdue", value: (r) => (r.isOverdue ? r.daysOverdue : 0) },
  { header: "Next due", value: (r) => r.nextDueDate },
  { header: "Notes", value: (r) => r.notes },
]

export function toCsv(rows: Row[]): string {
  const lines = [COLUMNS.map((c) => cell(c.header)).join(",")]
  for (const row of rows) {
    lines.push(COLUMNS.map((c) => cell(c.value(row))).join(","))
  }
  // BOM so Excel decodes UTF-8; CRLF so it splits rows correctly.
  return `﻿${lines.join("\r\n")}\r\n`
}
