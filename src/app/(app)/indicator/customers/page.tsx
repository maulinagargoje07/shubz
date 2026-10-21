import Link from "next/link"
import { Users } from "lucide-react"

import { DataTable, type Column } from "@/components/data-table/table"
import { FilterBar, Pagination } from "@/components/data-table/filters"
import { AccessToggle } from "@/components/indicator/access-toggle"
import { AccessStatus, BuyerCell, ContactCell, SubscriptionStatus, ValidTill } from "@/components/indicator/cells"
import { ExportLinks } from "@/components/indicator/export-links"
import { IndicatorToolbar } from "@/components/indicator/toolbar"
import { IndicatorUnavailable } from "@/components/indicator/unavailable"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/ui/status"
import { formatDate, formatIST } from "@/lib/fy"
import {
  ACCESS_FILTERS,
  EXPIRY_STATUS_FILTERS,
  PLAN_FILTERS,
  planLabel,
  REPEAT_FILTERS,
  type Customer,
  type CustomerList,
} from "@/lib/indicator"
import { formatINRShort } from "@/lib/money"
import { can } from "@/lib/permissions"
import type { RawParam } from "@/lib/search-params"
import { requirePermissionPage } from "@/lib/session"
import { listCustomers, PaymentsApiError } from "@/server/indicator/api"
import { customerFilters, customerSort, filterParams, fromRecord, hrefWith, PER_PAGE } from "@/server/indicator/filters"

export const dynamic = "force-dynamic"
export const metadata = { title: "Customers" }

const PATH = "/indicator/customers"

/**
 * The sheet's Customers tab: one row per person, repeat purchases merged on
 * TradingView username, with the date their access runs out and its colour.
 * "Expiring soon" is who to ask for a renewal; "Expired" is who to remove.
 */
export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, RawParam>>
}) {
  const user = await requirePermissionPage("VIEW_INDICATOR")
  const filters = customerFilters(fromRecord(await searchParams))
  const canExport = can(user, "EXPORT_DATA")
  const canTick = can(user, "MANAGE_TRADINGVIEW_ACCESS")

  let data: CustomerList
  try {
    data = await listCustomers({
      mode: filters.mode,
      q: filters.q,
      status: filters.status,
      plan: filters.plan,
      access: filters.access,
      repeat: filters.repeat,
      sort: customerSort(filters),
      limit: PER_PAGE,
      offset: (filters.page - 1) * PER_PAGE,
    })
  } catch (error) {
    if (!(error instanceof PaymentsApiError)) throw error
    return (
      <div className="pb-8">
        <PageHeader title="Customers" />
        <IndicatorUnavailable error={error} />
      </div>
    )
  }

  // The mode goes into links only when it isn't the checkout's own.
  const mode = data.mode === data.serviceMode ? undefined : data.mode
  const listFilters = {
    q: filters.q,
    status: filters.status,
    plan: filters.plan,
    access: filters.access,
    repeat: filters.repeat,
  }
  const params = filterParams({ ...listFilters, mode })

  const columns: Column<Customer>[] = [
    {
      id: "buyer",
      header: "Customer",
      priority: "primary",
      cell: (row) => <BuyerCell name={row.fullName} email={row.email} tradingviewId={row.tradingviewId} />,
    },
    {
      id: "status",
      header: "Status",
      priority: "primary",
      align: "right",
      hideLabelOnCard: true,
      cell: (row) => (
        <span className="inline-flex flex-col items-end gap-1">
          <AccessStatus status={row.accessStatus} />
          <span className="inline-flex items-center gap-1 text-[0.6875rem] text-muted-foreground">
            AutoPay <SubscriptionStatus status={row.subscriptionStatus} />
            {row.subscriptionCount > 1 ? `×${row.subscriptionCount}` : ""}
          </span>
        </span>
      ),
    },
    {
      id: "contact",
      header: "Contact",
      priority: "secondary",
      cell: (row) => <ContactCell phone={row.contactNumber} />,
    },
    {
      id: "validTill",
      header: "Access valid till",
      priority: "secondary",
      cell: (row) => <ValidTill date={row.validTill} daysLeft={row.daysLeft} />,
    },
    {
      id: "purchases",
      header: "Purchases",
      priority: "secondary",
      cell: (row) => (
        <Link
          href={hrefWith("/indicator/payments", { q: row.tradingviewId, mode })}
          className="group block hover:text-primary"
          title="See their purchases"
        >
          <span className="font-medium tabular-nums">{row.purchaseCount}×</span>
          <span className="text-xs text-muted-foreground group-hover:text-primary"> · {formatINRShort(row.totalPaidPaise)}</span>
          <span className="block whitespace-nowrap text-xs text-muted-foreground">
            {row.latestPlan ? planLabel(row.latestPlan) : "plan unknown"}
            {row.latestPurchase ? ` · ${formatDate(row.latestPurchase, "d MMM yyyy")}` : ""}
          </span>
          {row.firstPurchase && row.purchaseCount > 1 ? (
            <span className="block whitespace-nowrap text-xs text-muted-foreground">
              since {formatDate(row.firstPurchase, "d MMM yyyy")}
            </span>
          ) : null}
        </Link>
      ),
    },
    {
      id: "actions",
      header: "TradingView access",
      align: "right",
      cell: (row) => (
        <AccessToggle
          subscriptionId={row.latestSubscriptionId}
          name={row.fullName}
          granted={row.access.granted}
          action={row.access.action}
          updatedBy={row.access.updatedBy}
          updatedLabel={row.access.updatedAt ? formatIST(row.access.updatedAt, "d MMM, h:mm a") : null}
          canEdit={canTick}
        />
      ),
    },
  ]

  const filtered = Boolean(filters.q || filters.status || filters.plan || filters.access || filters.repeat)

  return (
    <div className="pb-8">
      <PageHeader
        title="Customers"
        description="One row per person, repeat purchases merged on TradingView username. Access valid till is the latest expiry across all of their purchases."
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
          params={listFilters}
          hidden={{ mode }}
          clearHref={hrefWith(PATH, { mode })}
          searchPlaceholder="Name, email, phone, TradingView or sub_ ID"
          filters={[
            { key: "status", label: "Statuses", options: [...EXPIRY_STATUS_FILTERS] },
            { key: "plan", label: "Plans", options: [...PLAN_FILTERS] },
            { key: "access", label: "Access", options: [...ACCESS_FILTERS] },
            { key: "repeat", label: "Purchases", options: [...REPEAT_FILTERS] },
          ]}
        />
      </div>

      {filters.status === "expiring" || filters.status === "expired" ? (
        <p className="px-4 pb-3 text-sm text-muted-foreground sm:px-6">
          {filters.status === "expiring"
            ? "Soonest to run out first. Message each one on WhatsApp to ask for a renewal."
            : "Longest expired first. Remove each one from the indicator on TradingView, then untick Access given."}
        </p>
      ) : null}

      {data.rows.length === 0 ? (
        <div className="px-4 sm:px-6">
          <EmptyState
            icon={<Users className="size-5" />}
            title={filtered ? "Nobody matches those filters" : "No customers yet"}
            description={
              filtered ? "Clear the filters to see everyone." : "Buyers appear here the moment their first AutoPay payment goes through."
            }
          />
        </div>
      ) : (
        <>
          <DataTable columns={columns} rows={data.rows} rowKey={(row) => row.customerKey} />
          <Pagination action={PATH} params={params} page={filters.page} perPage={PER_PAGE} total={data.total} />
        </>
      )}
    </div>
  )
}
