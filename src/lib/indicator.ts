/**
 * The 7 Godfather Strategies indicator: shapes and words.
 *
 * Subscribers, payments and failed payments are not stored in this app. They
 * live in the shubztrader-payments service, which takes the Razorpay AutoPay
 * payments on shubztrader.com, and are read through its admin API by
 * server/indicator/api.ts. The types below mirror that API's JSON.
 *
 * Pure module: no server imports, so client components can use the labels.
 * Money is integer paise, as everywhere else; times are ISO strings in UTC.
 */

/** Razorpay test keys or live keys. Test purchases never mix with real ones. */
export const INDICATOR_MODES = ["live", "test"] as const
export type IndicatorMode = (typeof INDICATOR_MODES)[number]

/** What an admin needs to do on TradingView for a subscriber, if anything. */
export type AccessAction = "grant" | "remove" | null

/** The Razorpay plan a subscriber is on. */
export type SubscriberPlan = {
  /** "1m" or "3m" (the website's two plans); null for a plan sold in neither slot. */
  key: string | null
  name: string
  amountPaise: number
  currency: string
  period: string
  interval: number
  /** How many months one payment buys; null for a daily or weekly plan. */
  months?: number | null
}

/**
 * The sheet's access status, judged on today's date in India:
 * no expiry (plan unknown) -> check; expiry before today -> expired;
 * expiry within 7 days, today included -> expiring; otherwise active.
 */
export type ExpiryStatus = "active" | "expiring" | "expired" | "check"

export type AccessState = {
  /** The "TradingView access given" tick. */
  granted: boolean
  /** Whether they are paid up right now. */
  shouldHave: boolean
  action: AccessAction
  updatedAt: string | null
  updatedBy: string | null
}

/** A plan the checkout sells, as the payments service reports it. */
export type PlanOnSale = {
  key: string
  id: string
  name?: string
  amountPaise?: number
  currency?: string
  period?: string
  interval?: number
  /** Charges per subscription. */
  totalCount?: number
  /** False when the service can't sell it right now; `error` says why. */
  available: boolean
  error: string | null
}

export type Subscriber = {
  subscriptionId: string
  mode: IndicatorMode
  planId: string
  /** null if the payments service couldn't read the plan from Razorpay. */
  plan?: SubscriberPlan | null
  customerId: string | null
  fullName: string
  email: string
  contactNumber: string
  tradingviewId: string
  /** Razorpay's subscription status. */
  status: string
  paidCount: number
  paymentCount: number
  totalPaidPaise: number
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  /** The date access runs out ("yyyy-mm-dd", India): last payment plus one billing cycle. */
  paidThrough: string | null
  daysLeft?: number | null
  accessStatus?: ExpiryStatus
  /** The key subscriptions are merged on in the Customers list. */
  customerKey?: string
  lastPaymentId: string | null
  lastPaymentAt: string | null
  confirmedVia: string
  createdAt: string | null
  updatedAt: string | null
  access: AccessState
}

/** A purchase: one successful payment, with the sheet's calculated columns. */
export type Payment = {
  paymentId: string
  subscriptionId: string
  invoiceId: string | null
  mode: IndicatorMode
  amountPaise: number
  /** Razorpay's fee (tax included); null until Razorpay reports it. */
  feePaise?: number | null
  taxPaise?: number | null
  /** Amount minus the fee, or the amount while the fee is unknown. */
  netPaise?: number
  currency: string
  status: string
  method: string | null
  paidAt: string | null
  fullName: string
  email: string
  contactNumber: string
  tradingviewId: string
  customerKey?: string
  subscriptionStatus?: string
  planId?: string
  plan?: SubscriberPlan | null
  /** The day of the payment in India ("yyyy-mm-dd"), and when what it bought runs out. */
  purchaseDate?: string | null
  expiryDate?: string | null
  daysLeft?: number | null
  accessStatus?: ExpiryStatus
  /** 1 for the customer's first purchase, 2 for their first renewal, and so on. */
  purchaseNumber?: number
  purchaseCount?: number
  timesRepurchased?: number
  repurchased?: boolean
}

/** One row per person: the sheet's Customers tab. */
export type Customer = {
  customerKey: string
  mode: IndicatorMode
  fullName: string
  email: string
  contactNumber: string
  tradingviewId: string
  subscriptionCount: number
  purchaseCount: number
  timesRepurchased: number
  repurchased: boolean
  totalPaidPaise: number
  netPaidPaise: number
  latestPlan: SubscriberPlan | null
  firstPurchase: string | null
  latestPurchase: string | null
  lastPaymentAt: string | null
  latestPaymentId: string | null
  /** The latest expiry across all their purchases ("yyyy-mm-dd"). */
  validTill: string | null
  daysLeft: number | null
  accessStatus: ExpiryStatus
  /** Their newest subscription (its AutoPay status is shown). Ticking access on any of a customer's subscriptions ticks all of them. */
  latestSubscriptionId: string
  subscriptionStatus: string
  firstSeenAt: string | null
  access: AccessState
}

export type FailedPayment = {
  paymentId: string
  subscriptionId: string
  mode: IndicatorMode
  fullName: string
  email: string
  contactNumber: string
  tradingviewId: string
  amountPaise: number | null
  currency: string | null
  method: string | null
  errorCode: string | null
  errorDescription: string | null
  errorSource: string | null
  errorStep: string | null
  errorReason: string | null
  /** True once the same buyer paid: on this checkout or a later one. */
  recovered: boolean
  recoveredAt: string | null
  createdAt: string | null
}

export type ListMeta = {
  /** The mode these rows are from. */
  mode: IndicatorMode
  /** The mode the checkout is charging in right now. */
  serviceMode: IndicatorMode
  generatedAt: string
  total: number
  limit: number
  offset: number
}

export type SubscriberList = ListMeta & { rows: Subscriber[] }
export type PaymentList = ListMeta & { rows: Payment[]; totalPaise: number; netPaise?: number }
export type FailedPaymentList = ListMeta & { rows: FailedPayment[] }
export type CustomerList = ListMeta & { rows: Customer[] }

/** The sheet's dashboard, in its three groups. See the payments service README for the rules. */
export type Dashboard = {
  /** Today's date in India ("yyyy-mm-dd"): what every status is judged against. */
  today: string
  access: { active: number; expiring: number; expired: number; check: number; customers: number }
  sales: {
    purchases: number
    oneMonth: number
    threeMonths: number
    otherPlans: number
    collectedPaise: number
    netEarnedPaise: number
    /** How many payments have their fee from Razorpay; the rest count in full. */
    feeKnownFor: number
    thisMonth: { monthStart: string | null; purchases: number; collectedPaise: number }
  }
  renewals: { renewedCustomers: number; renewalRate: number; averagePaidPerCustomerPaise: number }
}

export type IndicatorOverview = {
  mode: IndicatorMode
  serviceMode: IndicatorMode
  generatedAt: string
  /** The plans on sale in this mode (1 month, 3 months). */
  plans?: PlanOnSale[]
  /** The first plan, from before there were two. */
  plan: { id: string; name: string; amountPaise: number; currency: string; period: string; interval: number } | null
  subscribers: {
    total: number
    current: number
    pending: number
    halted: number
    paused: number
    ended: number
    newThisMonth: number
    /** Active and total subscribers per plan; key null is a plan sold in neither slot. */
    byPlan?: { key: string | null; current: number; total: number }[]
  }
  access: { entitled: number; granted: number; needsAccess: number; needsRemoval: number }
  revenue: {
    /** Start of this month in India. */
    monthStart: string | null
    monthPaise: number
    monthCount: number
    totalPaise: number
    totalCount: number
  }
  failed: { unrecovered: number; unrecoveredBuyers: number; last7Days: number; total: number }
  /** Missing only from a payments service older than the dashboard. */
  dashboard?: Dashboard
  latest: {
    /** One row per person, longest waiting first. */
    needsAccess: Customer[]
    needsRemoval: Customer[]
    /** Customers whose access runs out within 7 days, soonest first. */
    expiring?: Customer[]
    payments: Payment[]
    failed: FailedPayment[]
  }
}

// ----------------------------------------------------------------- filters

export const STATUS_FILTERS = [
  { value: "current", label: "Active" },
  { value: "pending", label: "Payment retrying" },
  { value: "halted", label: "Halted" },
  { value: "paused", label: "Paused" },
  { value: "ended", label: "Ended" },
] as const
export type StatusFilter = (typeof STATUS_FILTERS)[number]["value"]
export const STATUS_FILTER_VALUES = STATUS_FILTERS.map((f) => f.value)

export const ACCESS_FILTERS = [
  { value: "grant", label: "Needs access" },
  { value: "remove", label: "Needs removal" },
  { value: "granted", label: "Access given" },
  { value: "not_granted", label: "Access not given" },
] as const
export type AccessFilter = (typeof ACCESS_FILTERS)[number]["value"]
export const ACCESS_FILTER_VALUES = ACCESS_FILTERS.map((f) => f.value)

export const PLAN_FILTERS = [
  { value: "1m", label: "1 month" },
  { value: "3m", label: "3 months" },
] as const
export type PlanFilter = (typeof PLAN_FILTERS)[number]["value"]
export const PLAN_FILTER_VALUES = PLAN_FILTERS.map((f) => f.value)

export const EXPIRY_STATUS_FILTERS = [
  { value: "active", label: "Active" },
  { value: "expiring", label: "Expiring soon" },
  { value: "expired", label: "Expired" },
  { value: "check", label: "Check plan" },
] as const
export type ExpiryStatusFilter = (typeof EXPIRY_STATUS_FILTERS)[number]["value"]
export const EXPIRY_STATUS_FILTER_VALUES = EXPIRY_STATUS_FILTERS.map((f) => f.value)

export const REPEAT_FILTERS = [
  { value: "yes", label: "Bought more than once" },
  { value: "no", label: "Bought once" },
] as const
export type RepeatFilter = (typeof REPEAT_FILTERS)[number]["value"]
export const REPEAT_FILTER_VALUES = REPEAT_FILTERS.map((f) => f.value)

export const RECOVERED_FILTERS = [
  { value: "no", label: "Not paid yet" },
  { value: "yes", label: "Paid later" },
] as const
export type RecoveredFilter = (typeof RECOVERED_FILTERS)[number]["value"]
export const RECOVERED_FILTER_VALUES = RECOVERED_FILTERS.map((f) => f.value)

// ------------------------------------------------------------------ labels

const STATUS_LABELS: Record<string, string> = {
  created: "Not paid",
  authenticated: "Active",
  active: "Active",
  pending: "Payment retrying",
  halted: "Halted",
  paused: "Paused",
  cancelled: "Cancelled",
  completed: "Completed",
  expired: "Expired",
}

/** What each status means for the business, for tooltips and exports. */
const STATUS_HINTS: Record<string, string> = {
  authenticated: "First payment done; AutoPay is set up.",
  active: "Paid and renewing by AutoPay.",
  pending: "A renewal failed. Razorpay is retrying it.",
  halted: "Every retry failed. AutoPay has stopped.",
  paused: "Paused from the Razorpay dashboard.",
  cancelled: "AutoPay was cancelled.",
  completed: "Every planned charge has been made.",
  expired: "Never paid before the checkout expired.",
}

export function subscriptionStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status
}

export function subscriptionStatusHint(status: string): string | undefined {
  return STATUS_HINTS[status]
}

const EXPIRY_STATUS_LABELS: Record<ExpiryStatus, string> = {
  active: "Active",
  expiring: "Expiring soon",
  expired: "Expired",
  check: "Check plan",
}

/** What each access status means, for tooltips. The sheet's colour key. */
const EXPIRY_STATUS_HINTS: Record<ExpiryStatus, string> = {
  active: "Paid up, with more than 7 days left.",
  expiring: "7 days or less left: time to ask for a renewal.",
  expired: "The time paid for has run out. Remove from the indicator unless they renew.",
  check: "The plan couldn't be read from Razorpay, so no expiry could be worked out.",
}

export function expiryStatusLabel(status: ExpiryStatus | string | null | undefined): string {
  if (!status) return "—"
  return EXPIRY_STATUS_LABELS[status as ExpiryStatus] ?? status
}

export function expiryStatusHint(status: ExpiryStatus | string | null | undefined): string | undefined {
  return status ? EXPIRY_STATUS_HINTS[status as ExpiryStatus] : undefined
}

/** "in 12 days", "today", "3 days ago", or "" when unknown. */
export function daysLeftLabel(daysLeft: number | null | undefined): string {
  if (daysLeft === null || daysLeft === undefined) return ""
  if (daysLeft === 0) return "today"
  if (daysLeft === 1) return "tomorrow"
  if (daysLeft === -1) return "yesterday"
  return daysLeft > 0 ? `in ${daysLeft} days` : `${-daysLeft} days ago`
}

const METHOD_LABELS: Record<string, string> = {
  card: "Card",
  upi: "UPI",
  netbanking: "Net banking",
  emandate: "e-Mandate",
  nach: "NACH",
  wallet: "Wallet",
  emi: "EMI",
  app: "App",
}

export function paymentMethodLabel(method: string | null | undefined): string {
  if (!method) return "—"
  return METHOD_LABELS[method] ?? method
}

const PLAN_LABELS: Record<string, string> = Object.fromEntries(PLAN_FILTERS.map((f) => [f.value, f.label]))

/** "1 month", "3 months", or the Razorpay plan's own name for anything else. */
export function planLabel(plan: { key: string | null; name?: string } | null | undefined): string {
  if (!plan) return "—"
  return (plan.key && PLAN_LABELS[plan.key]) || plan.name || "—"
}

/** "1-month plan", "3-month plan", or the Razorpay plan's own name. */
export function planName(plan: { key: string | null; name?: string } | null | undefined): string {
  if (!plan) return "—"
  if (plan.key === "1m") return "1-month plan"
  if (plan.key === "3m") return "3-month plan"
  return plan.name || "—"
}

export const MODE_LABELS: Record<IndicatorMode, string> = {
  live: "Live",
  test: "Test",
}
