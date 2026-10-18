/**
 * Download buttons for a list: the rows matching the current filters, every
 * page of them. Real links to a route handler (styled as buttons), so the
 * browser saves the file with its name, "Save link as" works, and no
 * JavaScript is involved.
 */

import { FileSpreadsheet, FileText } from "lucide-react"
import { cn } from "cn"

import { buttonVariants } from "@/components/ui/button"
import { hrefWith } from "@/server/indicator/filters"

export function ExportLinks({
  href,
  params,
}: {
  /** The list's export route, e.g. /indicator/subscribers/export */
  href: string
  params: Record<string, string | undefined>
}) {
  const className = cn(buttonVariants({ variant: "outline" }), "h-9")
  return (
    <>
      <a href={hrefWith(href, { ...params, format: "xlsx" })} download className={className}>
        <FileSpreadsheet className="size-4" aria-hidden />
        Excel
      </a>
      <a href={hrefWith(href, { ...params, format: "csv" })} download className={className}>
        <FileText className="size-4" aria-hidden />
        CSV
      </a>
    </>
  )
}
