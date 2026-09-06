/**
 * The data grid — a SERVER component.
 *
 * Every list in this app is server-driven: the server does the filtering,
 * sorting and pagination and hands down exactly one page of rows. A
 * client-side table library was therefore shipping ~46 kB of JavaScript to
 * re-render markup the server had already produced, and doing no work the
 * server had not already done. This renders the same grid with zero client
 * JavaScript.
 *
 * The column API is deliberately close to what it replaced — `header` plus a
 * `cell` render function — so call sites read the same.
 *
 * Responsiveness is the other reason this exists. A seven-column table cannot
 * be made to work on a 390px phone by scrolling it sideways; the reader loses
 * the row they were on. Instead each column declares a `priority`:
 *
 *   primary    always visible, becomes the card title on mobile
 *   secondary  visible from `sm` up, becomes card metadata on mobile
 *   tertiary   visible from `lg` up, hidden entirely on mobile
 *
 * Below `sm` the same data renders as a stacked card list. Same markup source,
 * no duplicated column definitions, no horizontal scrolling.
 */

import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { cn } from "cn"

export type ColumnPriority = "primary" | "secondary" | "tertiary"

export type Column<TRow> = {
  /** Stable key; also the React key for the cell. */
  id: string
  header: React.ReactNode
  cell: (row: TRow) => React.ReactNode
  /** Controls both column visibility and card layout. Defaults to secondary. */
  priority?: ColumnPriority
  /** Right-align numeric columns so digits line up down the column. */
  align?: "left" | "right"
  /** Hide the label above this value in the mobile card. */
  hideLabelOnCard?: boolean
  className?: string
}

const PRIORITY_VISIBILITY: Record<ColumnPriority, string> = {
  primary: "",
  secondary: "hidden sm:table-cell",
  tertiary: "hidden lg:table-cell",
}

export type DataTableProps<TRow> = {
  columns: Column<TRow>[]
  rows: TRow[]
  /** Stable identity for React keys and row links. */
  rowKey: (row: TRow) => string
  /** Makes the whole row a link. Far better than an onClick for a server component. */
  rowHref?: (row: TRow) => string
  empty?: React.ReactNode
}

export function DataTable<TRow>({
  columns,
  rows,
  rowKey,
  rowHref,
  empty = "Nothing to show yet.",
}: DataTableProps<TRow>) {
  if (rows.length === 0) {
    return (
      <div className="mx-4 rounded-xl border border-dashed border-border/70 bg-card/60 px-6 py-12 text-center text-sm text-muted-foreground sm:mx-6">
        {empty}
      </div>
    )
  }

  // Separate actions column from data columns if present
  const actionsCol = columns.find((c) => c.id === "actions")
  const dataColumns = columns.filter((c) => c.id !== "actions")

  // Find primary column for title (usually left-aligned) and secondary primary for header right (e.g. amount or status)
  const primaryLeft =
    dataColumns.find((c) => (c.priority ?? "secondary") === "primary" && c.align !== "right") ??
    dataColumns[0]
  const primaryRight = dataColumns.find(
    (c) => c !== primaryLeft && (c.priority ?? "secondary") === "primary" && c.align === "right"
  )
  const rest = dataColumns.filter((c) => c !== primaryLeft && c !== primaryRight)

  return (
    <>
      {/* ---------- Phones: an executive stacked card per row ---------- */}
      <ul className="flex flex-col gap-2.5 px-4 sm:hidden">
        {rows.map((row) => {
          const key = rowKey(row)
          const href = rowHref?.(row)

          return (
            <li key={key}>
              <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-xs transition-all">
                {/* Header line: Title & Metric */}
                <div className="flex items-start justify-between gap-2.5">
                  {href ? (
                    <Link
                      href={href}
                      className="group min-w-0 flex-1 text-[0.9375rem] font-semibold text-foreground hover:text-primary transition-colors flex items-center justify-between"
                    >
                      <span className="truncate">{primaryLeft.cell(row)}</span>
                      <ChevronRight
                        className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-active:translate-x-0.5 ml-1.5"
                        aria-hidden
                      />
                    </Link>
                  ) : (
                    <div className="min-w-0 flex-1 text-[0.9375rem] font-semibold text-foreground">
                      {primaryLeft.cell(row)}
                    </div>
                  )}

                  {primaryRight ? (
                    <div className="shrink-0 text-right font-medium">
                      {primaryRight.cell(row)}
                    </div>
                  ) : null}
                </div>

                {/* Secondary metadata grid */}
                {rest.filter((column) => (column.priority ?? "secondary") !== "tertiary").length > 0 ? (
                  <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border/50 pt-2">
                    {rest
                      .filter((column) => (column.priority ?? "secondary") !== "tertiary")
                      .map((column) => (
                        <div key={column.id} className="min-w-0">
                          {column.hideLabelOnCard ? null : (
                            <dt className="text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground/75">
                              {column.header}
                            </dt>
                          )}
                          <dd className="mt-0.5 truncate text-sm text-foreground/90">
                            {column.cell(row)}
                          </dd>
                        </div>
                      ))}
                  </dl>
                ) : null}

                {/* Action buttons footer for mobile card */}
                {actionsCol ? (
                  <div className="mt-2.5 flex items-center justify-end border-t border-border/50 pt-2">
                    {actionsCol.cell(row)}
                  </div>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>

      {/* ---------- Tablet and up: a real table ---------- */}
      <div className="hidden sm:block">
        <div className="scroll-x mx-6 rounded-xl border border-border/80 bg-card shadow-xs">
          <table className="w-full caption-bottom text-sm">
            <thead>
              <tr className="border-b border-border/80 bg-secondary/35">
                {columns.map((column) => (
                  <th
                    key={column.id}
                    scope="col"
                    className={cn(
                      "px-4 py-3 text-left text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground/80",
                      column.align === "right" && "text-right",
                      PRIORITY_VISIBILITY[column.priority ?? "secondary"],
                      column.className
                    )}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.map((row) => {
                const key = rowKey(row)
                const href = rowHref?.(row)

                return (
                  <tr
                    key={key}
                    className="transition-colors hover:bg-secondary/35"
                  >
                    {columns.map((column, index) => (
                      <td
                        key={column.id}
                        className={cn(
                          "px-4 py-3 align-middle",
                          column.align === "right" && "text-right",
                          PRIORITY_VISIBILITY[column.priority ?? "secondary"],
                          column.className
                        )}
                      >
                        {href && index === 0 ? (
                          <Link href={href} className="block font-medium text-foreground hover:text-primary transition-colors hover:underline">
                            {column.cell(row)}
                          </Link>
                        ) : (
                          column.cell(row)
                        )}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
