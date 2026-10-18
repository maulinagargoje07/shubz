/**
 * The shubztrader-payments admin API, read from this server only.
 *
 * The payments service owns the indicator data: it takes Razorpay AutoPay
 * payments on shubztrader.com and records subscribers, payments and failed
 * attempts. This app never connects to its database; it asks the service over
 * HTTPS with PAYMENTS_ADMIN_KEY, which stays on the server. Nothing here may be
 * imported into a client component.
 *
 * Every call is `no-store`: the admin pages refresh themselves every few
 * seconds, and a cached answer would show yesterday's buyers.
 */

import { paymentsApiConfig } from "@/lib/env"
import type {
  AccessFilter,
  FailedPaymentList,
  IndicatorMode,
  IndicatorOverview,
  PaymentList,
  RecoveredFilter,
  StatusFilter,
  Subscriber,
  SubscriberList,
} from "@/lib/indicator"

export type PaymentsApiErrorKind =
  | "not_configured"
  | "unauthorized"
  | "disabled"
  | "unreachable"
  | "rate_limited"
  | "not_found"
  | "bad_request"
  | "server_error"

/** A failure worth explaining to an admin, not a stack trace. */
export class PaymentsApiError extends Error {
  constructor(
    readonly kind: PaymentsApiErrorKind,
    message: string,
    readonly status?: number
  ) {
    super(message)
    this.name = "PaymentsApiError"
  }
}

type Query = Record<string, string | number | undefined | null>

const TIMEOUT_MS = 15_000

async function call<T>(
  path: string,
  options: { query?: Query; body?: unknown } = {}
): Promise<T> {
  const config = paymentsApiConfig()
  if (!config.ok) throw new PaymentsApiError("not_configured", config.problem)

  const url = new URL(`/api/admin${path}`, config.url)
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value))
  }

  let res: Response
  try {
    res = await fetch(url, {
      method: options.body === undefined ? "GET" : "POST",
      headers: {
        authorization: `Bearer ${config.key}`,
        accept: "application/json",
        ...(options.body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    throw new PaymentsApiError(
      "unreachable",
      "Couldn't reach the payments service. It may be restarting; this page tries again by itself."
    )
  }

  if (res.ok) return (await res.json()) as T

  const body = (await res.json().catch(() => null)) as { error?: string; message?: string } | null
  switch (res.status) {
    case 401:
      throw new PaymentsApiError(
        "unauthorized",
        "The payments service didn't accept PAYMENTS_ADMIN_KEY. It must match ADMIN_API_KEY on shubztrader-payments exactly.",
        401
      )
    case 503:
      if (body?.error === "admin_api_disabled") {
        throw new PaymentsApiError(
          "disabled",
          "The payments service's admin API is off: set ADMIN_API_KEY (at least 32 characters) on shubztrader-payments in Railway.",
          503
        )
      }
      throw new PaymentsApiError("unreachable", "The payments service is unavailable right now.", 503)
    case 429:
      throw new PaymentsApiError(
        "rate_limited",
        "The payments service is refusing requests for a few minutes after too many wrong keys.",
        429
      )
    case 404:
      throw new PaymentsApiError("not_found", body?.message ?? "Not found.", 404)
    case 400:
      throw new PaymentsApiError("bad_request", "The payments service rejected the request.", 400)
    default:
      throw new PaymentsApiError("server_error", "The payments service had a problem. Try again in a minute.", res.status)
  }
}

// ------------------------------------------------------------------ reads

export type SubscriberQuery = {
  mode?: IndicatorMode
  q?: string
  status?: StatusFilter
  access?: AccessFilter
  limit?: number
  offset?: number
}

export type PaymentQuery = {
  mode?: IndicatorMode
  q?: string
  /** "yyyy-MM-dd", India time, inclusive. */
  from?: string
  to?: string
  limit?: number
  offset?: number
}

export type FailedPaymentQuery = {
  mode?: IndicatorMode
  q?: string
  recovered?: RecoveredFilter
  limit?: number
  offset?: number
}

export function getOverview(mode?: IndicatorMode): Promise<IndicatorOverview> {
  return call("/overview", { query: { mode } })
}

export function listSubscribers(query: SubscriberQuery = {}): Promise<SubscriberList> {
  return call("/subscribers", { query })
}

export function listPayments(query: PaymentQuery = {}): Promise<PaymentList> {
  return call("/payments", { query })
}

export function listFailedPayments(query: FailedPaymentQuery = {}): Promise<FailedPaymentList> {
  return call("/failed-payments", { query })
}

/** The largest page the API serves, used to walk a whole list for an export. */
const EXPORT_PAGE = 1000
/** An export this big is a mistake or an attack; refuse rather than run out of memory. */
const EXPORT_MAX_ROWS = 50_000

/**
 * Every row matching a filter, page by page, for the Excel and CSV downloads.
 * `meta` is the first page's, so the file can say which mode it came from.
 */
export async function fetchAll<Meta extends { total: number; rows: unknown[] }>(
  fetchPage: (page: { limit: number; offset: number }) => Promise<Meta>
): Promise<{ rows: Meta["rows"]; meta: Meta }> {
  const first = await fetchPage({ limit: EXPORT_PAGE, offset: 0 })
  if (first.total > EXPORT_MAX_ROWS) {
    throw new PaymentsApiError(
      "bad_request",
      `That is ${first.total} rows; narrow the filters to under ${EXPORT_MAX_ROWS} and try again.`
    )
  }

  const rows: Meta["rows"] = [...first.rows]
  while (rows.length < first.total) {
    const next = await fetchPage({ limit: EXPORT_PAGE, offset: rows.length })
    if (next.rows.length === 0) break // the list shrank while we were reading it
    rows.push(...next.rows)
  }
  return { rows, meta: first }
}

// ----------------------------------------------------------------- writes

export type AccessChange = {
  ok: true
  changed: boolean
  before: { granted: boolean; updatedAt: string | null; updatedBy: string | null }
  subscriber: Subscriber | null
}

/** Set the "TradingView access given" tick. `actor` is shown next to it. */
export function setTradingViewAccess(
  subscriptionId: string,
  granted: boolean,
  actor: string
): Promise<AccessChange> {
  return call(`/subscribers/${encodeURIComponent(subscriptionId)}/access`, {
    body: { granted, actor },
  })
}
