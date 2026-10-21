/**
 * Excel or CSV of the customers matching the list's filters, every page: the
 * sheet's Customers tab as a file.
 *
 * A route handler rather than a server action so it is a plain link the
 * browser saves as a file. Route handlers don't run the (app) layout, so the
 * session and permissions are checked here.
 */

import { redirect } from "next/navigation"

import { can } from "@/lib/permissions"
import { getSessionUser } from "@/lib/session"
import { fetchAll, listCustomers, PaymentsApiError } from "@/server/indicator/api"
import { exportCustomers, exportFailure, exportFormat } from "@/server/indicator/export"
import { customerFilters, customerSort, fromUrl } from "@/server/indicator/filters"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (!can(user, "VIEW_INDICATOR") || !can(user, "EXPORT_DATA")) redirect("/indicator/customers?denied=1")

  const url = new URL(request.url)
  const filters = customerFilters(fromUrl(url))
  const { mode, q, status, plan, access, repeat } = filters

  try {
    const { rows, meta } = await fetchAll((page) =>
      listCustomers({ mode, q, status, plan, access, repeat, sort: customerSort(filters), ...page })
    )
    return exportCustomers(rows, meta.mode, exportFormat(url.searchParams.get("format")))
  } catch (error) {
    if (error instanceof PaymentsApiError) return exportFailure(error)
    throw error
  }
}
