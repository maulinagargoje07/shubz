/**
 * CSV download of the leads currently on screen.
 *
 * A route handler rather than a server action so it is a plain link the browser
 * navigates to, which is what makes the file save with a sensible name and no
 * JavaScript involved.
 *
 * Until the campaign sender is built, this is how a segment reaches a messaging
 * tool, so the phone column is the first thing that has to survive the trip
 * into Excel intact.
 *
 * Route handlers do not run the (app) layout, so the session and permission are
 * checked here explicitly.
 */

import { redirect } from "next/navigation"

import { todayIST, formatIST } from "@/lib/fy"
import { SOURCE_LABELS } from "@/lib/labels"
import { LEAD_STATUSES, LEAD_STATUS_LABELS, type LeadStatus } from "@/lib/leads"
import { can } from "@/lib/permissions"
import { enumParam, idParam, textParam } from "@/lib/search-params"
import { getSessionUser } from "@/lib/session"
import { leadsForExport, type LeadRow } from "@/server/leads/queries"

export const dynamic = "force-dynamic"

function cell(value: unknown): string {
  if (value === null || value === undefined) return ""
  const text = String(value)
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

const COLUMNS: { header: string; value: (row: LeadRow) => unknown }[] = [
  { header: "Name", value: (r) => r.fullName },
  /*
   * Two phone columns on purpose. The apostrophe-prefixed one is for reading in
   * Excel, which would otherwise drop the leading + and treat the number as a
   * formula; the plain E.164 one is for pasting into a messaging tool, which
   * needs the + and would choke on the apostrophe.
   */
  { header: "Phone", value: (r) => `'${r.phoneE164}` },
  { header: "Phone (E.164)", value: (r) => r.phoneE164 },
  { header: "Email", value: (r) => r.email },
  { header: "City", value: (r) => r.city },
  { header: "Trading experience", value: (r) => r.tradingExperience },
  {
    header: "Source",
    value: (r) => SOURCE_LABELS[r.source as keyof typeof SOURCE_LABELS] ?? r.source,
  },
  { header: "Lists", value: (r) => r.lists.join(" | ") },
  {
    header: "Status",
    value: (r) => LEAD_STATUS_LABELS[r.leadStatus] ?? r.leadStatus,
  },
  { header: "Stage", value: (r) => r.lifecycleStage },
  {
    header: "Captured at",
    value: (r) => (r.leadCapturedAt ? formatIST(r.leadCapturedAt, "yyyy-MM-dd HH:mm") : ""),
  },
  { header: "Added on", value: (r) => formatIST(r.createdAt, "yyyy-MM-dd") },
]

function toCsv(rows: LeadRow[]): string {
  const lines = [COLUMNS.map((c) => cell(c.header)).join(",")]
  for (const row of rows) {
    lines.push(COLUMNS.map((c) => cell(c.value(row))).join(","))
  }
  // BOM so Excel decodes UTF-8; CRLF so it splits rows correctly.
  return `﻿${lines.join("\r\n")}\r\n`
}

export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user) redirect("/login")

  // Downloading the whole lead book is its own capability, separate from being
  // able to read a lead on screen.
  if (!can(user, "EXPORT_DATA")) {
    redirect("/leads")
  }

  const params = new URL(request.url).searchParams
  const get = (key: string) => params.get(key) ?? undefined

  const rows = await leadsForExport({
    q: textParam(get("q")),
    status: enumParam<LeadStatus>(get("status"), LEAD_STATUSES),
    source: enumParam(get("source"), Object.keys(SOURCE_LABELS)),
    list: idParam(get("list")),
    experience: textParam(get("experience")),
    from: textParam(get("from")),
    to: textParam(get("to")),
    includeConverted: get("converted") === "1",
  })

  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="shubztrader-leads-${todayIST()}.csv"`,
      "Cache-Control": "no-store, private",
    },
  })
}
