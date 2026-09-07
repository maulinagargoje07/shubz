/**
 * CSV download of enrollment records.
 *
 * A route handler rather than a server action, because this has to be a plain
 * link the browser navigates to — that is what makes the file save with a
 * sensible name and no JavaScript involved.
 *
 * Route handlers do not run the (app) layout, so the session is checked here
 * explicitly. Records are the whole fee book; this must not be fetchable
 * unauthenticated.
 */

import { redirect } from "next/navigation"

import { getSessionUser } from "@/lib/session"
import { ENROLLMENT_STATUS_LABELS } from "@/lib/labels"
import { enumParam, idParam, textParam } from "@/lib/search-params"
import { can } from "@/lib/permissions"
import { todayIST } from "@/lib/fy"
import { listEnrollmentRecords, toCsv } from "@/server/records/export"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user) redirect("/login")

  // This URL is the entire fee book. Downloading it is its own capability,
  // separate from being able to read a single record on screen.
  if (!can(user, "EXPORT_DATA")) {
    return new Response("You do not have permission to export data.", { status: 403 })
  }

  const params = new URL(request.url).searchParams

  // The export honours whatever filters the list was showing, so what is
  // downloaded matches what was on screen — including how the list treats a
  // filter it cannot parse, which is to ignore it.
  const rows = await listEnrollmentRecords({
    programId: idParam(params.get("program") ?? undefined),
    status: enumParam(
      params.get("status") ?? undefined,
      Object.keys(ENROLLMENT_STATUS_LABELS)
    ),
    overdueOnly: textParam(params.get("overdue") ?? undefined) === "1",
    batchId: idParam(params.get("batch") ?? undefined, ["none"]),
  })

  const csv = toCsv(rows)
  const filename = `shubztrader-records-${todayIST()}.csv`

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      // A fee book is per-user and changes constantly; never let a proxy hold it.
      "Cache-Control": "no-store, private",
    },
  })
}
