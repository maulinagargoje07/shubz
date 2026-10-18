import { CircleAlert } from "lucide-react"

import { DataTable, type Column } from "@/components/data-table/table"
import { FilterBar, Pagination } from "@/components/data-table/filters"
import { BuyerCell, ContactCell, TradingViewCell, When } from "@/components/indicator/cells"
import { ExportLinks } from "@/components/indicator/export-links"
import { IndicatorToolbar } from "@/components/indicator/toolbar"
import { IndicatorUnavailable } from "@/components/indicator/unavailable"
import { PageHeader } from "@/components/page-header"
import { EmptyState, StatusPill } from "@/components/ui/status"
import { formatIST } from "@/lib/fy"
import { paymentMethodLabel, RECOVERED_FILTERS, type FailedPayment, type FailedPaymentList } from "@/lib/indicator"
import { formatINR } from "@/lib/money"
import { can } from "@/lib/permissions"
import type { RawParam } from "@/lib/search-params"
import { requirePermissionPage } from "@/lib/session"
import { listFailedPayments, PaymentsApiError } from "@/server/indicator/api"
import { failedFilters, filterParams, fromRecord, hrefWith, PER_PAGE } from "@/server/indicator/filters"

export const dynamic = "force-dynamic"
export const metadata = { title: "Failed payments" }

const PATH = "/indicator/failed"

export default async function FailedPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, RawParam>>
}) {
  const user = await requirePermissionPage("VIEW_INDICATOR")
  const filters = failedFilters(fromRecord(await searchParams))
  const canExport = can(user, "EXPORT_DATA")

  let data: FailedPaymentList
  try {
    data = await listFailedPayments({
      mode: filters.mode,
      q: filters.q,
      recovered: filters.recovered,
      limit: PER_PAGE,
      offset: (filters.page - 1) * PER_PAGE,
    })
  } catch (error) {
    if (!(error instanceof PaymentsApiError)) throw error
    return (
      <div className="pb-8">
        <PageHeader title="Failed payments" />
        <IndicatorUnavailable error={error} />
      </div>
    )
  }

  const mode = data.mode === data.serviceMode ? undefined : data.mode
  const params = filterParams({ q: filters.q, recovered: filters.recovered, mode })

  const columns: Column<FailedPayment>[] = [
    {
      id: "buyer",
      header: "Buyer",
      priority: "primary",
      cell: (row) => <BuyerCell name={row.fullName} email={row.email} />,
    },
    {
      id: "outcome",
      header: "Paid later?",
      priority: "primary",
      align: "right",
      hideLabelOnCard: true,
      cell: (row) =>
        row.recovered ? (
          <span title={row.recoveredAt ? `Paid ${formatIST(row.recoveredAt)}` : undefined}>
            <StatusPill tone="paid">Paid later</StatusPill>
          </span>
        ) : (
          <StatusPill tone="overdue">Not paid</StatusPill>
        ),
    },
    {
      id: "reason",
      header: "Reason",
      priority: "secondary",
      cell: (row) => (
        <span className="block min-w-0 whitespace-normal">
          <span className="line-clamp-3">{row.errorDescription ?? "Payment failed"}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {[paymentMethodLabel(row.method), row.errorReason?.replace(/_/g, " ")].filter((v) => v && v !== "—").join(" · ")}
          </span>
        </span>
      ),
    },
    {
      id: "when",
      header: "When",
      priority: "secondary",
      cell: (row) => <When iso={row.createdAt} />,
    },
    {
      id: "tradingview",
      header: "TradingView",
      priority: "secondary",
      cell: (row) => <TradingViewCell id={row.tradingviewId} />,
    },
    {
      id: "contact",
      header: "Contact",
      priority: "secondary",
      cell: (row) => <ContactCell phone={row.contactNumber} />,
    },
    {
      id: "amount",
      header: "Amount",
      priority: "tertiary",
      align: "right",
      cell: (row) => (
        <span className="tabular-nums text-muted-foreground">
          {row.amountPaise === null ? "—" : formatINR(row.amountPaise)}
        </span>
      ),
    },
  ]

  const filtered = Boolean(filters.q || filters.recovered)

  return (
    <div className="pb-8">
      <PageHeader
        title="Failed payments"
        description="Checkout attempts the bank or Razorpay declined. “Not paid” means they haven't paid since: worth a WhatsApp."
        actions={canExport ? <ExportLinks href={`${PATH}/export`} params={params} /> : undefined}
      />
      <IndicatorToolbar
        path={PATH}
        params={filterParams({ q: filters.q, recovered: filters.recovered })}
        mode={data.mode}
        serviceMode={data.serviceMode}
        generatedAt={data.generatedAt}
      />

      <div className="pt-4">
        <FilterBar
          action={PATH}
          params={{ q: filters.q, recovered: filters.recovered }}
          hidden={{ mode }}
          clearHref={hrefWith(PATH, { mode })}
          searchPlaceholder="Name, email, phone, TradingView or ID"
          filters={[{ key: "recovered", label: "Outcomes", options: [...RECOVERED_FILTERS] }]}
        />
      </div>

      {data.rows.length === 0 ? (
        <div className="px-4 sm:px-6">
          <EmptyState
            icon={<CircleAlert className="size-5" />}
            title={filtered ? "Nothing matches those filters" : "No failed payments"}
            description={
              filtered ? "Clear the filters to see every attempt." : "Declined attempts at checkout appear here."
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
