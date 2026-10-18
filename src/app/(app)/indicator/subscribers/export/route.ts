/**
 * Excel or CSV of the subscribers matching the list's filters, every page.
 *
 * A route handler rather than a server action so it is a plain link the
 * browser saves as a file. Route handlers don't run the (app) layout, so the
 * session and permissions are checked here.
 */

import { redirect } from "next/navigation"

import { can } from "@/lib/permissions"
import { getSessionUser } from "@/lib/session"
import { fetchAll, listSubscribers, PaymentsApiError } from "@/server/indicator/api"
import { exportFailure, exportFormat, exportSubscribers } from "@/server/indicator/export"
import { fromUrl, subscriberFilters } from "@/server/indicator/filters"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (!can(user, "VIEW_INDICATOR") || !can(user, "EXPORT_DATA")) redirect("/indicator/subscribers?denied=1")

  const url = new URL(request.url)
  const { mode, q, status, access } = subscriberFilters(fromUrl(url))

  try {
    const { rows, meta } = await fetchAll((page) => listSubscribers({ mode, q, status, access, ...page }))
    return exportSubscribers(rows, meta.mode, exportFormat(url.searchParams.get("format")))
  } catch (error) {
    if (error instanceof PaymentsApiError) return exportFailure(error)
    throw error
  }
}
