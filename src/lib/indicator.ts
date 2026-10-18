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

export type Subscriber = {
  subscriptionId: string
  mode: IndicatorMode
  planId: string
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
  /** Last payment plus one billing period: when what they paid for runs out. */
  paidThrough: string | null
  lastPaymentId: string | null
  lastPaymentAt: string | null
  confirmedVia: string
  createdAt: string | null
  updatedAt: string | null
  access: {
    /** The "TradingView access given" tick. */
    granted: boolean
    /** Whether they are paid up right now. */
    shouldHave: boolean
    action: AccessAction
    updatedAt: string | null
    updatedBy: string | null
  }
}

export type Payment = {
  paymentId: string
  subscriptionId: string
  invoiceId: string | null
  mode: IndicatorMode
  amountPaise: number
  currency: string
  status: string
  method: string | null
  paidAt: string | null
  fullName: string
  email: string
  contactNumber: string
  tradingviewId: string
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
export type PaymentList = ListMeta & { rows: Payment[]; totalPaise: number }
export type FailedPaymentList = ListMeta & { rows: FailedPayment[] }

export type IndicatorOverview = {
  mode: IndicatorMode
  serviceMode: IndicatorMode
  generatedAt: string
  plan: { id: string; name: string; amountPaise: number; currency: string; period: string; interval: number } | null
  subscribers: {
    total: number
    current: number
    pending: number
    halted: number
    paused: number
    ended: number
    newThisMonth: number
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
  latest: {
    needsAccess: Subscriber[]
    needsRemoval: Subscriber[]
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

export const MODE_LABELS: Record<IndicatorMode, string> = {
  live: "Live",
  test: "Test",
}
