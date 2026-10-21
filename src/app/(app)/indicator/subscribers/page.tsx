import Link from "next/link"
import { ReceiptIndianRupee } from "lucide-react"

import { DataTable, type Column } from "@/components/data-table/table"
import { FilterBar, Pagination } from "@/components/data-table/filters"
import { AccessToggle } from "@/components/indicator/access-toggle"
import { AccessStatus, BuyerCell, ContactCell, SubscriptionStatus, ValidTill, When } from "@/components/indicator/cells"
import { ExportLinks } from "@/components/indicator/export-links"
import { IndicatorToolbar } from "@/components/indicator/toolbar"
import { IndicatorUnavailable } from "@/components/indicator/unavailable"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/ui/status"
import { formatIST } from "@/lib/fy"
import {
  ACCESS_FILTERS,
  PLAN_FILTERS,
  planName,
  STATUS_FILTERS,
  type Subscriber,
  type SubscriberList,
} from "@/lib/indicator"
import { formatINRShort } from "@/lib/money"
import { can } from "@/lib/permissions"
import type { RawParam } from "@/lib/search-params"
import { requirePermissionPage } from "@/lib/session"
import { listSubscribers, PaymentsApiError } from "@/server/indicator/api"
import { filterParams, fromRecord, hrefWith, PER_PAGE, subscriberFilters } from "@/server/indicator/filters"

export const dynamic = "force-dynamic"
export const metadata = { title: "Subscriptions" }

const PATH = "/indicator/subscribers"

export default async function SubscribersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, RawParam>>
}) {
  const user = await requirePermissionPage("VIEW_INDICATOR")
  const filters = subscriberFilters(fromRecord(await searchParams))
  const canExport = can(user, "EXPORT_DATA")
  const canTick = can(user, "MANAGE_TRADINGVIEW_ACCESS")

  let data: SubscriberList
  try {
    data = await listSubscribers({
      mode: filters.mode,
      q: filters.q,
      status: filters.status,
      access: filters.access,
      plan: filters.plan,
      limit: PER_PAGE,
      offset: (filters.page - 1) * PER_PAGE,
    })
  } catch (error) {
    if (!(error instanceof PaymentsApiError)) throw error
    return (
      <div className="pb-8">
        <PageHeader title="Subscriptions" />
        <IndicatorUnavailable error={error} />
      </div>
    )
  }

  // The mode goes into links only when it isn't the checkout's own.
  const mode = data.mode === data.serviceMode ? undefined : data.mode
  const params = filterParams({ q: filters.q, status: filters.status, access: filters.access, plan: filters.plan, mode })

  const columns: Column<Subscriber>[] = [
    {
      id: "buyer",
      header: "Buyer",
      priority: "primary",
      cell: (row) => <BuyerCell name={row.fullName} email={row.email} tradingviewId={row.tradingviewId} />,
    },
    {
      id: "status",
      header: "Status",
      priority: "primary",
      align: "right",
      hideLabelOnCard: true,
      cell: (row) => <SubscriptionStatus status={row.status} />,
    },
    {
      id: "contact",
      header: "Contact",
      priority: "secondary",
      cell: (row) => <ContactCell phone={row.contactNumber} />,
    },
    {
      id: "paid",
      header: "Paid",
      priority: "secondary",
      cell: (row) => (
        <Link
          href={hrefWith("/indicator/payments", { q: row.subscriptionId, mode })}
          className="group block hover:text-primary"
          title="See their payments"
        >
          <span className="font-medium tabular-nums">{formatINRShort(row.totalPaidPaise)}</span>
          <span className="text-xs text-muted-foreground group-hover:text-primary">
            {" "}
            · {row.paymentCount}×
          </span>
          {row.plan ? <span className="block text-xs text-muted-foreground">{planName(row.plan)}</span> : null}
        </Link>
      ),
    },
    {
      id: "validTill",
      header: "Access valid till",
      priority: "secondary",
      cell: (row) => (
        <span className="inline-flex flex-col items-start gap-1">
          <AccessStatus status={row.accessStatus} />
          <ValidTill date={row.paidThrough} daysLeft={row.daysLeft} />
        </span>
      ),
    },
    {
      id: "joined",
      header: "Joined",
      priority: "tertiary",
      cell: (row) => <When iso={row.createdAt} pattern="d MMM yyyy" />,
    },
    {
      id: "actions",
      header: "TradingView access",
      align: "right",
      cell: (row) => (
        <AccessToggle
          subscriptionId={row.subscriptionId}
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

  const filtered = Boolean(filters.q || filters.status || filters.access || filters.plan)

  return (
    <div className="pb-8">
      <PageHeader
        title="Subscriptions"
        description="Every Razorpay AutoPay subscription and its status. Tick “Access given” once the username is added on TradingView. For one row per person, see Customers."
        actions={canExport ? <ExportLinks href={`${PATH}/export`} params={params} /> : undefined}
      />
      <IndicatorToolbar
        path={PATH}
        params={filterParams({ q: filters.q, status: filters.status, access: filters.access, plan: filters.plan })}
        mode={data.mode}
        serviceMode={data.serviceMode}
        generatedAt={data.generatedAt}
      />

      <div className="pt-4">
        <FilterBar
          action={PATH}
          params={{ q: filters.q, status: filters.status, access: filters.access, plan: filters.plan }}
          hidden={{ mode }}
          clearHref={hrefWith(PATH, { mode })}
          searchPlaceholder="Name, email, phone, TradingView or sub_ ID"
          filters={[
            { key: "status", label: "Statuses", options: [...STATUS_FILTERS] },
            { key: "access", label: "Access", options: [...ACCESS_FILTERS] },
            { key: "plan", label: "Plans", options: [...PLAN_FILTERS] },
          ]}
        />
      </div>

      {data.rows.length === 0 ? (
        <div className="px-4 sm:px-6">
          <EmptyState
            icon={<ReceiptIndianRupee className="size-5" />}
            title={filtered ? "Nobody matches those filters" : "No subscribers yet"}
            description={
              filtered
                ? "Clear the filters to see everyone."
                : "Buyers appear here the moment their first AutoPay payment goes through."
            }
          />
        </div>
      ) : (
        <>
          <DataTable columns={columns} rows={data.rows} rowKey={(row) => row.subscriptionId} />
          <Pagination action={PATH} params={params} page={filters.page} perPage={PER_PAGE} total={data.total} />
        </>
      )}
    </div>
  )
}
