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
      <div className="mx-4 rounded-xl border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground sm:mx-6">
        {empty}
      </div>
    )
  }

  const primary = columns.find((c) => (c.priority ?? "secondary") === "primary") ?? columns[0]
  const rest = columns.filter((c) => c !== primary)

  return (
    <>
      {/* ---------- Phones: a stacked card per row ---------- */}
      <ul className="flex flex-col gap-2 px-4 sm:hidden">
        {rows.map((row) => {
          const key = rowKey(row)
          const href = rowHref?.(row)

          const body = (
            <>
              <div className="text-[0.9375rem] font-medium text-foreground">
                {primary.cell(row)}
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
                {rest
                  .filter((column) => (column.priority ?? "secondary") !== "tertiary")
                  .map((column) => (
                    <div key={column.id} className="min-w-0">
                      {column.hideLabelOnCard ? null : (
                        <dt className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
                          {column.header}
                        </dt>
                      )}
                      <dd className="truncate text-sm">{column.cell(row)}</dd>
                    </div>
                  ))}
              </dl>
            </>
          )

          return (
            <li key={key}>
              {href ? (
                <Link
                  href={href}
                  className="block rounded-xl border bg-card p-3.5 transition-colors active:bg-accent/40"
                >
                  {body}
                </Link>
              ) : (
                <div className="rounded-xl border bg-card p-3.5">{body}</div>
              )}
            </li>
          )
        })}
      </ul>

      {/* ---------- Tablet and up: a real table ---------- */}
      <div className="hidden sm:block">
        <div className="scroll-x mx-6 rounded-xl border bg-card">
          <table className="w-full caption-bottom text-sm">
            <thead>
              <tr className="border-b">
                {columns.map((column) => (
                  <th
                    key={column.id}
                    scope="col"
                    className={cn(
                      "px-4 py-2.5 text-left text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground",
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
            <tbody>
              {rows.map((row) => {
                const key = rowKey(row)
                const href = rowHref?.(row)

                return (
                  <tr
                    key={key}
                    className="border-b transition-colors last:border-0 hover:bg-accent/40"
                  >
                    {columns.map((column, index) => (
                      <td
                        key={column.id}
                        className={cn(
                          "px-4 py-2.5 align-middle",
                          column.align === "right" && "text-right",
                          PRIORITY_VISIBILITY[column.priority ?? "secondary"],
                          column.className
                        )}
                      >
                        {/*
                          The link wraps the first cell rather than the row:
                          nesting an anchor around <tr> is invalid HTML, and a
                          JS row-click handler would drag this whole component
                          back to the client.
                        */}
                        {href && index === 0 ? (
                          <Link href={href} className="block hover:underline">
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
