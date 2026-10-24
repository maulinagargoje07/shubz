import { CustomersGrid } from "@/components/indicator/customers-grid"
import { ExportLinks } from "@/components/indicator/export-links"
import { IndicatorToolbar } from "@/components/indicator/toolbar"
import { IndicatorUnavailable } from "@/components/indicator/unavailable"
import { PageHeader } from "@/components/page-header"
import { EXPIRY_STATUS_FILTERS, PLAN_FILTERS, type Customer, type CustomerList } from "@/lib/indicator"
import { can } from "@/lib/permissions"
import type { RawParam } from "@/lib/search-params"
import { requirePermissionPage } from "@/lib/session"
import { fetchAll, listCustomers, PaymentsApiError } from "@/server/indicator/api"
import { customerFilters, filterParams, fromRecord } from "@/server/indicator/filters"

export const dynamic = "force-dynamic"
export const metadata = { title: "Customers" }

const PATH = "/indicator/customers"

/**
 * The sheet's Customers tab: one row per person, repeat purchases merged on
 * TradingView username, in an Excel-style grid — every column sorts and
 * filters in the browser. The whole list is loaded (a few hundred rows), so
 * filtering is instant and the download is exactly what's on screen.
 */
export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, RawParam>>
}) {
  const user = await requirePermissionPage("VIEW_INDICATOR")
  const params = await searchParams
  const filters = customerFilters(fromRecord(params))
  const canExport = can(user, "EXPORT_DATA")
  const canTick = can(user, "MANAGE_TRADINGVIEW_ACCESS")

  let rows: Customer[]
  let meta: CustomerList
  try {
    const all = await fetchAll((page) => listCustomers({ mode: filters.mode, sort: "newest", ...page }))
    rows = all.rows
    meta = all.meta
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
  const mode = meta.mode === meta.serviceMode ? undefined : meta.mode

  // Links from the dashboard arrive as ?status=expiring, ?access=grant and so
  // on; they become the grid's starting filters, ticked like in the sheet.
  const initialFilters = {
    status: filters.status ? [label(EXPIRY_STATUS_FILTERS, filters.status)] : undefined,
    latestPlan: filters.plan ? [label(PLAN_FILTERS, filters.plan)] : undefined,
    todo: filters.access === "grant" ? ["Needs access"] : filters.access === "remove" ? ["Needs removal"] : undefined,
    accessGiven: filters.access === "granted" ? ["Yes"] : filters.access === "not_granted" ? ["No"] : undefined,
    repurchased: filters.repeat === "yes" ? ["Yes"] : filters.repeat === "no" ? ["No"] : undefined,
  }

  return (
    <div className="pb-8">
      <PageHeader
        title="Customers"
        description="One row per person, repeat purchases merged on TradingView username. Access valid till is the latest expiry across all of their purchases. Click a heading to sort; the funnel filters that column."
        actions={canExport ? <ExportLinks href={`${PATH}/export`} params={filterParams({ mode })} /> : undefined}
      />
      <IndicatorToolbar path={PATH} mode={meta.mode} serviceMode={meta.serviceMode} generatedAt={meta.generatedAt} />
      <div className="pt-4">
        <CustomersGrid
          key={JSON.stringify(params)}
          rows={rows}
          canTick={canTick}
          initialFilters={initialFilters}
          initialSearch={filters.q}
        />
      </div>
    </div>
  )
}

function label(options: readonly { value: string; label: string }[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? value
}
