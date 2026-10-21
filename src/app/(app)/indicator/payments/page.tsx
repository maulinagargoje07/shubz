import Link from "next/link"
import { IndianRupee } from "lucide-react"
import { cn } from "cn"

import { DataTable, type Column } from "@/components/data-table/table"
import { FilterBar, Pagination } from "@/components/data-table/filters"
import { AccessStatus, BuyerCell, RazorpayId, ValidTill, When } from "@/components/indicator/cells"
import { ExportLinks } from "@/components/indicator/export-links"
import { IndicatorToolbar } from "@/components/indicator/toolbar"
import { IndicatorUnavailable } from "@/components/indicator/unavailable"
import { PageHeader } from "@/components/page-header"
import { EmptyState, StatusPill } from "@/components/ui/status"
import { formatDate, todayIST } from "@/lib/fy"
import {
  EXPIRY_STATUS_FILTERS,
  paymentMethodLabel,
  PLAN_FILTERS,
  planLabel,
  REPEAT_FILTERS,
  type Payment,
  type PaymentList,
} from "@/lib/indicator"
import { formatINR } from "@/lib/money"
import { can } from "@/lib/permissions"
import type { RawParam } from "@/lib/search-params"
import { requirePermissionPage } from "@/lib/session"
import { listPayments, PaymentsApiError } from "@/server/indicator/api"
import { filterParams, fromRecord, hrefWith, paymentFilters, PER_PAGE } from "@/server/indicator/filters"

export const dynamic = "force-dynamic"
export const metadata = { title: "Purchases" }

const PATH = "/indicator/payments"

/** First and last day of a calendar month, as "yyyy-MM-dd". `month` is 1-12. */
function monthRange(year: number, month: number): { from: string; to: string } {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const mm = String(month).padStart(2, "0")
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(last).padStart(2, "0")}` }
}

/**
 * The sheet's Purchases tab: every successful payment (a first payment or an
 * AutoPay renewal) with the calculated columns: plan, expiry date, days left,
 * access status, and which purchase this is for the customer.
 */
export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, RawParam>>
}) {
  const user = await requirePermissionPage("VIEW_INDICATOR")
  const filters = paymentFilters(fromRecord(await searchParams))
  const canExport = can(user, "EXPORT_DATA")

  let data: PaymentList
  try {
    data = await listPayments({
      mode: filters.mode,
      q: filters.q,
      from: filters.from,
      to: filters.to,
      plan: filters.plan,
      status: filters.status,
      repeat: filters.repeat,
      limit: PER_PAGE,
      offset: (filters.page - 1) * PER_PAGE,
    })
  } catch (error) {
    if (!(error instanceof PaymentsApiError)) throw error
    return (
      <div className="pb-8">
        <PageHeader title="Purchases" />
        <IndicatorUnavailable error={error} />
      </div>
    )
  }

  const mode = data.mode === data.serviceMode ? undefined : data.mode
  const listFilters = {
    q: filters.q,
    from: filters.from,
    to: filters.to,
    plan: filters.plan,
    status: filters.status,
    repeat: filters.repeat,
  }
  const params = filterParams({ ...listFilters, mode })

  // Quick ranges, by the calendar in India.
  const [year, month] = todayIST().split("-").map(Number)
  const thisMonth = monthRange(year, month)
  const lastMonth = month === 1 ? monthRange(year - 1, 12) : monthRange(year, month - 1)
  const ranges = [
    { label: "This month", ...thisMonth },
    { label: "Last month", ...lastMonth },
  ]

  const columns: Column<Payment>[] = [
    {
      id: "buyer",
      header: "Buyer",
      priority: "primary",
      cell: (row) => <BuyerCell name={row.fullName} email={row.email} tradingviewId={row.tradingviewId} />,
    },
    {
      id: "amount",
      header: "Amount",
      priority: "primary",
      align: "right",
      hideLabelOnCard: true,
      cell: (row) => (
        <span className="inline-flex flex-col items-end">
          <span className="font-semibold tabular-nums text-paid-foreground">{formatINR(row.amountPaise)}</span>
          {row.feePaise !== null && row.feePaise !== undefined && row.netPaise !== undefined ? (
            <span className="text-xs text-muted-foreground tabular-nums" title="After Razorpay's fee">
              net {formatINR(row.netPaise)}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: "paid",
      header: "Paid at",
      priority: "secondary",
      cell: (row) => (
        <span className="inline-flex flex-col">
          <When iso={row.paidAt} />
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            {paymentMethodLabel(row.method)}
            {row.status !== "captured" ? <StatusPill tone="pending">{row.status}</StatusPill> : null}
          </span>
        </span>
      ),
    },
    {
      id: "plan",
      header: "Plan",
      priority: "secondary",
      cell: (row) => (
        <span className="inline-flex flex-col">
          <span className="whitespace-nowrap">{planLabel(row.plan)}</span>
          {row.purchaseNumber ? (
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              {row.purchaseCount && row.purchaseCount > 1
                ? `#${row.purchaseNumber} of ${row.purchaseCount}`
                : "first purchase"}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: "expiry",
      header: "Expires",
      priority: "secondary",
      cell: (row) => (
        <span className="inline-flex flex-col items-start gap-1">
          <AccessStatus status={row.accessStatus} />
          <ValidTill date={row.expiryDate} daysLeft={row.daysLeft} />
        </span>
      ),
    },
    {
      id: "payment",
      header: "Payment ID",
      priority: "tertiary",
      cell: (row) => <RazorpayId id={row.paymentId} label="payment ID" />,
    },
  ]

  const filtered = Boolean(filters.q || filters.from || filters.to || filters.plan || filters.status || filters.repeat)

  return (
    <div className="pb-8">
      <PageHeader
        title="Purchases"
        description="Every successful payment: first payments and AutoPay renewals, each with the plan it bought and when that runs out."
        actions={canExport ? <ExportLinks href={`${PATH}/export`} params={params} /> : undefined}
      />
      <IndicatorToolbar
        path={PATH}
        params={filterParams(listFilters)}
        mode={data.mode}
        serviceMode={data.serviceMode}
        generatedAt={data.generatedAt}
      />

      <div className="pt-4">
        <FilterBar
          action={PATH}
          params={{ q: filters.q, plan: filters.plan, status: filters.status, repeat: filters.repeat }}
          hidden={{ mode }}
          clearHref={hrefWith(PATH, { mode })}
          hasActive={filtered}
          searchPlaceholder="Name, email, phone, TradingView or pay_ ID"
          filters={[
            { key: "plan", label: "Plans", options: [...PLAN_FILTERS] },
            { key: "status", label: "Statuses", options: [...EXPIRY_STATUS_FILTERS] },
            { key: "repeat", label: "Buyers", options: [...REPEAT_FILTERS] },
          ]}
        >
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <label className="min-w-0">
              <span className="sr-only">From</span>
              <input
                type="date"
                name="from"
                defaultValue={filters.from ?? ""}
                aria-label="From date"
                className="h-10 w-full rounded-lg border border-border/80 bg-card px-3 text-sm text-foreground outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20 sm:w-40"
              />
            </label>
            <label className="min-w-0">
              <span className="sr-only">To</span>
              <input
                type="date"
                name="to"
                defaultValue={filters.to ?? ""}
                aria-label="To date"
                className="h-10 w-full rounded-lg border border-border/80 bg-card px-3 text-sm text-foreground outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20 sm:w-40"
              />
            </label>
          </div>
        </FilterBar>
        <div className="-mt-1 flex flex-wrap items-center gap-2 px-4 pb-4 sm:px-6">
          {ranges.map((range) => {
            const active = filters.from === range.from && filters.to === range.to
            return (
              <Link
                key={range.label}
                href={hrefWith(PATH, { ...listFilters, from: range.from, to: range.to, mode })}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {range.label}
              </Link>
            )
          })}
        </div>
      </div>

      <div className="px-4 pb-3 sm:px-6">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">{formatINR(data.totalPaise)}</span> from{" "}
          {data.total} {data.total === 1 ? "purchase" : "purchases"}
          {data.netPaise !== undefined && data.netPaise !== data.totalPaise ? (
            <>
              {" "}
              · <span className="tabular-nums">{formatINR(data.netPaise)}</span> after Razorpay fees
            </>
          ) : null}
          {filters.from || filters.to
            ? ` · ${filters.from ? formatDate(filters.from) : "the start"} to ${filters.to ? formatDate(filters.to) : "today"}`
            : ""}
        </p>
      </div>

      {data.rows.length === 0 ? (
        <div className="px-4 sm:px-6">
          <EmptyState
            icon={<IndianRupee className="size-5" />}
            title={filtered ? "No purchases match those filters" : "No purchases yet"}
            description={
              filtered ? "Clear the filters to see every purchase." : "Purchases appear here the moment Razorpay confirms them."
            }
          />
        </div>
      ) : (
        <>
          <DataTable columns={columns} rows={data.rows} rowKey={(row) => row.paymentId} />
          <Pagination action={PATH} params={params} page={filters.page} perPage={PER_PAGE} total={data.total} />
        </>
      )}
    </div>
  )
}
