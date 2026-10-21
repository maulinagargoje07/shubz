/**
 * Excel or CSV of the purchases matching the list's filters, every page: the
 * sheet's Purchases tab as a file.
 * Route handlers don't run the (app) layout, so access is checked here.
 */

import { redirect } from "next/navigation"

import { can } from "@/lib/permissions"
import { getSessionUser } from "@/lib/session"
import { fetchAll, listPayments, PaymentsApiError } from "@/server/indicator/api"
import { exportFailure, exportFormat, exportPayments } from "@/server/indicator/export"
import { fromUrl, paymentFilters } from "@/server/indicator/filters"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (!can(user, "VIEW_INDICATOR") || !can(user, "EXPORT_DATA")) redirect("/indicator/payments?denied=1")

  const url = new URL(request.url)
  const { mode, q, from, to, plan, status, repeat } = paymentFilters(fromUrl(url))

  try {
    const { rows, meta } = await fetchAll((page) => listPayments({ mode, q, from, to, plan, status, repeat, ...page }))
    return exportPayments(rows, meta.mode, exportFormat(url.searchParams.get("format")))
  } catch (error) {
    if (error instanceof PaymentsApiError) return exportFailure(error)
    throw error
  }
}
