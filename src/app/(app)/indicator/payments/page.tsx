import { ExportLinks } from "@/components/indicator/export-links"
import { PurchasesGrid } from "@/components/indicator/purchases-grid"
import { IndicatorToolbar } from "@/components/indicator/toolbar"
import { IndicatorUnavailable } from "@/components/indicator/unavailable"
import { PageHeader } from "@/components/page-header"
import { EXPIRY_STATUS_FILTERS, PLAN_FILTERS, type Payment, type PaymentList } from "@/lib/indicator"
import { can } from "@/lib/permissions"
import type { RawParam } from "@/lib/search-params"
import { requirePermissionPage } from "@/lib/session"
import { fetchAll, listPayments, PaymentsApiError } from "@/server/indicator/api"
import { filterParams, fromRecord, paymentFilters } from "@/server/indicator/filters"

export const dynamic = "force-dynamic"
export const metadata = { title: "Purchases" }

const PATH = "/indicator/payments"

/**
 * The sheet's Purchases tab: every successful payment (a first payment or an
 * AutoPay renewal) with the calculated columns, in an Excel-style grid. The
 * whole list is loaded so every column sorts and filters in the browser.
 */
export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, RawParam>>
}) {
  const user = await requirePermissionPage("VIEW_INDICATOR")
  const params = await searchParams
  const filters = paymentFilters(fromRecord(params))
  const canExport = can(user, "EXPORT_DATA")

  let rows: Payment[]
  let meta: PaymentList
  try {
    const all = await fetchAll((page) => listPayments({ mode: filters.mode, ...page }))
    rows = all.rows
    meta = all.meta
  } catch (error) {
    if (!(error instanceof PaymentsApiError)) throw error
    return (
      <div className="pb-8">
        <PageHeader title="Purchases" />
        <IndicatorUnavailable error={error} />
      </div>
    )
  }

  const mode = meta.mode === meta.serviceMode ? undefined : meta.mode

  // Links arrive as ?plan=3m, ?status=expiring, ?repeat=yes; they become the
  // grid's starting filters. A ?from/?to date range is typed into the Date
  // funnel instead, so it isn't pre-applied here.
  const initialFilters = {
    plan: filters.plan ? [label(PLAN_FILTERS, filters.plan)] : undefined,
    status: filters.status ? [label(EXPIRY_STATUS_FILTERS, filters.status)] : undefined,
    repurchased: filters.repeat === "yes" ? ["Yes"] : filters.repeat === "no" ? ["No"] : undefined,
  }

  return (
    <div className="pb-8">
      <PageHeader
        title="Purchases"
        description="Every successful payment: first payments and AutoPay renewals, each with the plan it bought and when that runs out. Click a heading to sort; the funnel filters that column."
        actions={canExport ? <ExportLinks href={`${PATH}/export`} params={filterParams({ mode })} /> : undefined}
      />
      <IndicatorToolbar path={PATH} mode={meta.mode} serviceMode={meta.serviceMode} generatedAt={meta.generatedAt} />
      <div className="pt-4">
        <PurchasesGrid key={JSON.stringify(params)} rows={rows} initialFilters={initialFilters} initialSearch={filters.q} />
      </div>
    </div>
  )
}

function label(options: readonly { value: string; label: string }[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? value
}
