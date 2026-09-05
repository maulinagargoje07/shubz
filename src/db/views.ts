/**
 * The `enrollment_balances` view.
 *
 * BALANCE IS NEVER A STORED COLUMN. Every "how much is owed" question in the
 * application reads this view — the fees dashboard, the overdue list, the
 * enrollment detail page, the receipt. Because it is computed from the ledger
 * on every read, it cannot drift when a payment is corrected.
 *
 * The view itself is defined in SQL in drizzle/0001_enrollment_balances.sql
 * (hand-written; drizzle-kit does not need to manage it). Here it is declared
 * with `.existing()` so queries against it are typed, and drizzle-kit leaves
 * it alone when diffing the schema.
 *
 * Keep this declaration and the SQL in step — the column list is the contract
 * between them.
 */

import { bigint, boolean, date, integer, pgView, uuid } from "drizzle-orm/pg-core"

export const enrollmentBalances = pgView("enrollment_balances", {
  enrollmentId: uuid("enrollment_id").notNull(),

  feeTotalPaise: bigint("fee_total_paise", { mode: "number" }).notNull(),
  discountPaise: bigint("discount_paise", { mode: "number" }).notNull(),

  /**
   * What is actually owed in total. Sum of the payment schedule when a
   * schedule exists; otherwise fee_total - discount.
   */
  netPayablePaise: bigint("net_payable_paise", { mode: "number" }).notNull(),
  totalPaidPaise: bigint("total_paid_paise", { mode: "number" }).notNull(),
  /** net_payable - total_paid. Negative means overpaid. */
  balanceDuePaise: bigint("balance_due_paise", { mode: "number" }).notNull(),

  /** True when an unpaid schedule row's due date has passed, in IST. */
  isOverdue: boolean("is_overdue").notNull(),
  /** Days since the OLDEST unpaid due date. 0 when not overdue. */
  daysOverdue: integer("days_overdue").notNull(),

  /** Earliest unpaid schedule row. Null when nothing is outstanding. */
  nextDueDate: date("next_due_date"),
  nextDueAmountPaise: bigint("next_due_amount_paise", { mode: "number" }),
}).existing()

export type EnrollmentBalance = typeof enrollmentBalances.$inferSelect
