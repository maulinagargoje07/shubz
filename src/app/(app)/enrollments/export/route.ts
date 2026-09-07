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
  const str = (key: string) => {
    const value = params.get(key)
    return value && value !== "" ? value : undefined
  }

  // The export honours whatever filters the list was showing, so what is
  // downloaded matches what was on screen.
  const rows = await listEnrollmentRecords({
    programId: str("program"),
    status: str("status"),
    overdueOnly: str("overdue") === "1",
    batchId: str("batch"),
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
