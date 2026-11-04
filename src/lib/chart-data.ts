/**
 * The dashboard's charts, worked out from the purchase rows the payments
 * service sends.
 *
 * This is arithmetic, not rules: purchases are grouped by the Indian calendar
 * day or month they were paid in, by plan, by payment method, and by whether
 * they were a first purchase or a renewal, and the amounts added up. Nothing
 * here decides what a purchase *is* — expiry, access status, which plan a
 * payment bought and whether it was a renewal still come from the payments
 * service on each row (see AGENTS.md, "Where the data lives").
 *
 * Pure module: no server imports, so it can be unit-tested with plain rows.
 */

import { format } from "date-fns"

import { paymentMethodLabel, planLabel, type Payment } from "@/lib/indicator"
import { toISTDateString } from "@/lib/fy"

export type DayPoint = {
  /** "yyyy-MM-dd", India. */
  day: string
  /** "4 Nov" */
  label: string
  collectedPaise: number
  purchases: number
  firstPurchases: number
  renewals: number
}

export type MonthPoint = {
  /** "yyyy-MM" */
  month: string
  /** "Nov 26" */
  label: string
  /** "November 2026" */
  longLabel: string
  /** "November" */
  name: string
  collectedPaise: number
  purchases: number
  firstPurchases: number
  renewals: number
}

export type Share = {
  key: string
  label: string
  count: number
  paise: number
}

export type PeriodTotals = { collectedPaise: number; purchases: number }

export type ChartData = {
  /** The last 30 days, oldest first, today last. */
  days: DayPoint[]
  /** The last 12 months, oldest first, this month last. */
  months: MonthPoint[]
  last30Days: PeriodTotals
  previous30Days: PeriodTotals
  thisMonth: PeriodTotals & { label: string; name: string }
  lastMonth: PeriodTotals & { label: string; name: string }
  /** Purchases by plan: 1 month, 3 months, then anything else. */
  plans: Share[]
  /** Purchases by payment method, most used first. */
  methods: Share[]
  firstPurchases: number
  renewals: number
}

const DAYS = 30
const MONTHS = 12

const ymd = (date: Date) => date.toISOString().slice(0, 10)

/** `days` calendar days before a "yyyy-MM-dd", as "yyyy-MM-dd". */
function shiftDay(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number)
  return ymd(new Date(Date.UTC(y, m - 1, d - days)))
}

/** `months` months before a "yyyy-MM", as "yyyy-MM". */
function shiftMonth(month: string, months: number): string {
  const [y, m] = month.split("-").map(Number)
  return ymd(new Date(Date.UTC(y, m - 1 - months, 1))).slice(0, 7)
}

/** A calendar day as a local Date, for date-fns formatting only. */
const asLocal = (day: string) => new Date(`${day.slice(0, 10)}T00:00:00`)

const empty = () => ({ collectedPaise: 0, purchases: 0, firstPurchases: 0, renewals: 0 })

const isRenewal = (payment: Payment) => (payment.purchaseNumber ?? 1) > 1

/**
 * @param payments every successful payment in the mode being viewed
 * @param today    the dashboard's "today" in India ("yyyy-MM-dd")
 */
export function buildChartData(payments: Payment[], today: string): ChartData {
  const byDay = new Map<string, ReturnType<typeof empty>>()
  const byMonth = new Map<string, ReturnType<typeof empty>>()
  const byPlan = new Map<string, Share>()
  const byMethod = new Map<string, Share>()
  let firstPurchases = 0
  let renewals = 0

  for (const payment of payments) {
    // The service sends the purchase day already judged in India; fall back
    // to the payment time for a row from an older service.
    const day = payment.purchaseDate ?? (payment.paidAt ? toISTDateString(new Date(payment.paidAt)) : null)
    if (!day) continue
    const renewal = isRenewal(payment)
    for (const [key, map] of [
      [day, byDay],
      [day.slice(0, 7), byMonth],
    ] as const) {
      const bucket = map.get(key) ?? empty()
      bucket.collectedPaise += payment.amountPaise
      bucket.purchases += 1
      if (renewal) bucket.renewals += 1
      else bucket.firstPurchases += 1
      map.set(key, bucket)
    }
    if (renewal) renewals += 1
    else firstPurchases += 1

    const planKey = payment.plan?.key ?? (payment.plan ? `other:${payment.plan.name}` : "unknown")
    const plan = byPlan.get(planKey) ?? {
      key: planKey,
      label: payment.plan ? planLabel(payment.plan) : "Plan not known",
      count: 0,
      paise: 0,
    }
    plan.count += 1
    plan.paise += payment.amountPaise
    byPlan.set(planKey, plan)

    const methodKey = payment.method ?? "unknown"
    const method = byMethod.get(methodKey) ?? {
      key: methodKey,
      label: payment.method ? paymentMethodLabel(payment.method) : "Not recorded",
      count: 0,
      paise: 0,
    }
    method.count += 1
    method.paise += payment.amountPaise
    byMethod.set(methodKey, method)
  }

  const days: DayPoint[] = []
  for (let i = DAYS - 1; i >= 0; i--) {
    const day = shiftDay(today, i)
    days.push({ day, label: format(asLocal(day), "d MMM"), ...(byDay.get(day) ?? empty()) })
  }

  const thisMonthKey = today.slice(0, 7)
  const months: MonthPoint[] = []
  for (let i = MONTHS - 1; i >= 0; i--) {
    const month = shiftMonth(thisMonthKey, i)
    const local = asLocal(`${month}-01`)
    months.push({
      month,
      label: format(local, "MMM yy"),
      longLabel: format(local, "MMMM yyyy"),
      name: format(local, "MMMM"),
      ...(byMonth.get(month) ?? empty()),
    })
  }

  const sum = (keys: string[], map: Map<string, ReturnType<typeof empty>>): PeriodTotals =>
    keys.reduce(
      (totals, key) => {
        const bucket = map.get(key)
        if (bucket) {
          totals.collectedPaise += bucket.collectedPaise
          totals.purchases += bucket.purchases
        }
        return totals
      },
      { collectedPaise: 0, purchases: 0 }
    )

  const lastMonthKey = shiftMonth(thisMonthKey, 1)
  const thisMonth = months[months.length - 1]
  const lastMonth = months[months.length - 2]

  // 1 month, then 3 months, then whatever else turned up.
  const planOrder = (share: Share) => (share.key === "1m" ? 0 : share.key === "3m" ? 1 : 2)
  const plans = [...byPlan.values()].sort((a, b) => planOrder(a) - planOrder(b) || b.count - a.count)
  const methods = [...byMethod.values()].sort((a, b) => b.count - a.count || b.paise - a.paise)

  return {
    days,
    months,
    last30Days: sum(days.map((d) => d.day), byDay),
    previous30Days: sum(
      Array.from({ length: DAYS }, (_, i) => shiftDay(today, DAYS + i)),
      byDay
    ),
    thisMonth: { ...sum([thisMonthKey], byMonth), label: thisMonth.longLabel, name: thisMonth.name },
    lastMonth: { ...sum([lastMonthKey], byMonth), label: lastMonth.longLabel, name: lastMonth.name },
    plans,
    methods,
    firstPurchases,
    renewals,
  }
}

/**
 * How much `now` is up or down on `before`, as a fraction (0.25 = up a
 * quarter). Null when there was nothing before to compare with.
 */
export function changeRatio(now: number, before: number): number | null {
  if (before <= 0) return null
  return (now - before) / before
}
