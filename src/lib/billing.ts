/**
 * Billing: turning an enrollment into a schedule of what is owed and when,
 * and allocating payments against it.
 *
 * The design decision that shapes this file: `payment_schedule` is the single
 * representation of "what is owed and when", for BOTH one-time and recurring
 * enrollments. That gives the whole system one overdue rule — an unpaid
 * schedule row past its due date — instead of two.
 *
 *   ONE_TIME, installments  -> N rows splitting net payable
 *   ONE_TIME, single payment -> 1 row for the whole net payable
 *   RECURRING                -> one row per billing cycle, rolled forward
 *
 * For RECURRING, `fee_total_paise` is ONE cycle's fee. An open-ended monthly
 * membership therefore never needs an invented contract total: it simply has
 * cycles raised up to a horizon, and more appear as they are paid.
 *
 * Allocation is FIFO by due date: money always settles the oldest debt first.
 * Schedule row statuses are DERIVED by replaying that allocation, never
 * incremented in place, so a corrected payment cannot leave a stale PAID row.
 */

import { addMonths, format, parseISO } from "date-fns"

import type { BillingCycle, BillingType } from "@/db/schema"
import { CYCLE_MONTHS } from "@/lib/programs"
import { splitInstallments } from "@/lib/money"
import { todayIST } from "@/lib/fy"

/** How many unpaid cycles an open-ended recurring enrollment keeps raised. */
export const RECURRING_HORIZON_CYCLES = 12
/** Top up the horizon when fewer than this many unpaid cycles remain. */
export const RECURRING_TOPUP_THRESHOLD = 3

export type PlannedInstallment = {
  seq: number
  /** "yyyy-MM-dd" */
  dueDate: string
  amountPaise: number
}

export type ScheduleInput = {
  billingType: BillingType
  billingCycle: BillingCycle | null
  /** For ONE_TIME: the whole fee. For RECURRING: one cycle's fee. */
  feeTotalPaise: number
  discountPaise: number
  /** "yyyy-MM-dd". Schedule starts here. */
  startDate: string
  /** "yyyy-MM-dd" or null. Recurring stops here when set. */
  endDate?: string | null
  /** ONE_TIME only: how many installments to split into. 1 = pay in full. */
  installments?: number
  /** RECURRING only: how many cycles to raise. Defaults to the horizon. */
  cycles?: number
}

function addCycle(dateISO: string, cycle: BillingCycle, count: number): string {
  return format(addMonths(parseISO(dateISO), CYCLE_MONTHS[cycle] * count), "yyyy-MM-dd")
}

/**
 * Build the installment rows for a new enrollment.
 *
 * Rows are generated from NET payable (fee - discount) so that, for a one-time
 * enrollment, SUM(schedule) equals fee - discount exactly and both branches of
 * the enrollment_balances view agree.
 */
export function planSchedule(input: ScheduleInput): PlannedInstallment[] {
  const {
    billingType,
    billingCycle,
    feeTotalPaise,
    discountPaise,
    startDate,
    endDate,
    installments = 1,
    cycles,
  } = input

  if (billingType === "ONE_TIME") {
    const net = Math.max(feeTotalPaise - discountPaise, 0)
    if (net === 0) return []

    // Monthly installments are the only cadence a one-time plan uses.
    return splitInstallments(net, installments).map((amountPaise, i) => ({
      seq: i + 1,
      dueDate: i === 0 ? startDate : addCycle(startDate, "MONTHLY", i),
      amountPaise,
    }))
  }

  // RECURRING
  if (!billingCycle) {
    throw new Error("A recurring enrollment must have a billing cycle")
  }

  // The discount applies to each cycle — a ₹500 off a ₹5,000/month membership
  // is ₹4,500 every month, not ₹500 off once.
  const perCycle = Math.max(feeTotalPaise - discountPaise, 0)
  if (perCycle === 0) return []

  const count = cycles ?? countCyclesToHorizon(startDate, endDate, billingCycle)

  const rows: PlannedInstallment[] = []
  for (let i = 0; i < count; i++) {
    const dueDate = i === 0 ? startDate : addCycle(startDate, billingCycle, i)
    // A fixed-term membership stops at its end date rather than running to the
    // rolling horizon.
    if (endDate && dueDate > endDate) break
    rows.push({ seq: i + 1, dueDate, amountPaise: perCycle })
  }
  return rows
}

function countCyclesToHorizon(
  startDate: string,
  endDate: string | null | undefined,
  cycle: BillingCycle
): number {
  if (!endDate) return RECURRING_HORIZON_CYCLES

  let n = 0
  while (n < 240) {
    const due = n === 0 ? startDate : addCycle(startDate, cycle, n)
    if (due > endDate) break
    n++
  }
  return Math.max(n, 1)
}

/**
 * Extend a recurring schedule when it is running short.
 *
 * Called after recording a payment and when an enrollment is read, so an
 * open-ended membership always has upcoming cycles raised without anyone
 * having to remember to generate them.
 */
export function planTopUpCycles(args: {
  billingCycle: BillingCycle
  perCyclePaise: number
  /** Existing rows, any status. */
  existing: Array<{ seq: number; dueDate: string; status: string }>
  endDate?: string | null
  startDate: string
}): PlannedInstallment[] {
  const { billingCycle, perCyclePaise, existing, endDate, startDate } = args

  const unpaid = existing.filter(
    (r) => r.status === "PENDING" || r.status === "PARTIAL" || r.status === "OVERDUE"
  )
  if (unpaid.length >= RECURRING_TOPUP_THRESHOLD) return []
  if (perCyclePaise <= 0) return []

  const lastSeq = existing.reduce((m, r) => Math.max(m, r.seq), 0)
  const lastDue = existing.reduce(
    (m, r) => (r.dueDate > m ? r.dueDate : m),
    startDate
  )

  const needed = RECURRING_HORIZON_CYCLES - unpaid.length
  const rows: PlannedInstallment[] = []

  for (let i = 1; i <= needed; i++) {
    const dueDate = addCycle(lastDue, billingCycle, i)
    if (endDate && dueDate > endDate) break
    rows.push({ seq: lastSeq + i, dueDate, amountPaise: perCyclePaise })
  }
  return rows
}

// ------------------------------------------------------------- allocation

export type AllocatableRow = {
  id: string
  seq: number
  dueDate: string
  amountPaise: number
  status: string
}

export type AllocationResult = {
  id: string
  /** What this row's status should become. */
  status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" | "WAIVED"
  /** How much of the total payments landed on this row. */
  allocatedPaise: number
}

/**
 * Replay every payment against the schedule, oldest due date first, and derive
 * what each row's status should now be.
 *
 * Derived rather than incremental: if a payment is soft-deleted or corrected,
 * re-running this from the full payment total produces the right answer, where
 * decrementing a stored counter would not.
 *
 * WAIVED rows are skipped entirely — forgiven debt absorbs no money.
 */
export function allocatePayments(
  rows: AllocatableRow[],
  totalPaidPaise: number,
  today: string = todayIST()
): AllocationResult[] {
  const ordered = [...rows].sort((a, b) =>
    a.dueDate === b.dueDate ? a.seq - b.seq : a.dueDate < b.dueDate ? -1 : 1
  )

  let remaining = Math.max(totalPaidPaise, 0)

  return ordered.map((row) => {
    if (row.status === "WAIVED") {
      return { id: row.id, status: "WAIVED" as const, allocatedPaise: 0 }
    }

    const allocated = Math.min(remaining, row.amountPaise)
    remaining -= allocated

    let status: AllocationResult["status"]
    if (allocated >= row.amountPaise) {
      status = "PAID"
    } else if (row.dueDate < today) {
      // Past due and not settled — overdue whether or not anything landed.
      status = "OVERDUE"
    } else if (allocated > 0) {
      status = "PARTIAL"
    } else {
      status = "PENDING"
    }

    return { id: row.id, status, allocatedPaise: allocated }
  })
}

/**
 * The earliest unpaid due date after allocation — what `next_due_date` on the
 * enrollment should be set to. Null when nothing is outstanding.
 */
export function deriveNextDueDate(
  rows: AllocatableRow[],
  allocations: AllocationResult[]
): string | null {
  const byId = new Map(allocations.map((a) => [a.id, a]))

  const outstanding = rows
    .filter((r) => {
      const a = byId.get(r.id)
      return a && a.status !== "PAID" && a.status !== "WAIVED"
    })
    .sort((a, b) => (a.dueDate === b.dueDate ? a.seq - b.seq : a.dueDate < b.dueDate ? -1 : 1))

  return outstanding[0]?.dueDate ?? null
}
