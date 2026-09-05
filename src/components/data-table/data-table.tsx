"use client"

/**
 * The one data grid used by every list in the app.
 *
 * All grids here are SERVER-driven: the server does the filtering, sorting and
 * pagination and hands down exactly one page of rows. TanStack Table is used
 * for column definition and rendering only, which is why the table is built
 * from `coreFeatures` alone — enabling the client-side pagination or sorting
 * features would have them silently re-process an already-paginated page and
 * disagree with the row count in the footer.
 *
 * Sorting and paging therefore work by changing URL search params, which makes
 * every list view linkable and survives a refresh.
 */

import {
  coreFeatures,
  flexRender,
  useTable,
  type ColumnDef,
  type RowData,
} from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "cn"

/**
 * The third generic is the cell VALUE type, which differs per column — a name
 * column yields string, a fee column number. One array cannot name them all,
 * so it stays open here and each column definition narrows it internally.
 */
export type DataTableColumns<TData extends RowData> = ColumnDef<
  typeof coreFeatures,
  TData,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any
>[]

export type DataTableProps<TData extends RowData> = {
  columns: DataTableColumns<TData>
  data: TData[]
  /** Shown when there are no rows at all. */
  emptyMessage?: string
  /** Row click target, e.g. a detail page. */
  getRowHref?: (row: TData) => string | null
  onRowClick?: (row: TData) => void
}

export function DataTable<TData extends RowData>({
  columns,
  data,
  emptyMessage = "Nothing to show yet.",
  onRowClick,
}: DataTableProps<TData>) {
  const table = useTable({
    features: coreFeatures,
    columns,
    data,
  })

  return (
    // Wide tables scroll inside their own container so the page body never
    // scrolls sideways.
    <div className="w-full overflow-x-auto">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  style={
                    header.column.columnDef.meta &&
                    typeof header.column.columnDef.meta === "object" &&
                    "width" in header.column.columnDef.meta
                      ? { width: String(header.column.columnDef.meta.width) }
                      : undefined
                  }
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>

        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-28 text-center text-sm text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                className={cn(onRowClick && "cursor-pointer")}
              >
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
