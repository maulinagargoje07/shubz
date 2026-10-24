"use client"

/**
 * An Excel-style grid: every column can be sorted by clicking its header and
 * filtered from a funnel menu (tick the values to keep, search within them,
 * from/to for dates and amounts), filters combine, and the bar above shows how
 * many rows match with totals, a search box and a download of exactly those
 * rows.
 *
 * It only sorts and filters what the server hands it; nothing is calculated
 * here, so the figures can never disagree with the payments service.
 *
 * Wide like a spreadsheet: it scrolls sideways on narrow screens with the
 * first column pinned, rather than hiding columns.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowDown, ArrowUp, Download, Filter, Search, X } from "lucide-react"
import { cn } from "cn"

import { formatDate, formatIST, toISTDateString } from "@/lib/fy"
import { formatINR } from "@/lib/money"

export type GridKind = "text" | "number" | "money" | "date" | "datetime" | "yesno"
export type GridValue = string | number | boolean | null | undefined

export type GridColumn<Row> = {
  /** Stable id; also what `initialFilters` is keyed by. */
  id: string
  header: string
  /** Decides how the value is shown, sorted, filtered and downloaded. Default "text". */
  kind?: GridKind
  /** The raw value: paise for money, "yyyy-mm-dd" for dates, ISO for datetimes. */
  value: (row: Row) => GridValue
  /** What to render instead of the formatted value. */
  cell?: (row: Row) => React.ReactNode
  align?: "left" | "right"
  /** Stays visible while the grid scrolls sideways. */
  pinned?: boolean
  /** Add this column up in the bar above the grid (money or number). */
  sum?: boolean
  /** Buttons and links: no sorting, no funnel, left out of the download. */
  plain?: boolean
}

/** The sheet's row colours. */
export type GridTone = "active" | "expiring" | "expired" | "check" | null | undefined

type Dir = "asc" | "desc"
type Sort = { id: string; dir: Dir }
/** `values` are the ticked labels (undefined = everything); from/to are "yyyy-mm-dd" or rupees. */
type ColumnFilter = { values?: string[]; from?: string; to?: string }
type SortKey = number | string | null
type Entry<Row> = { row: Row; labels: Record<string, string>; raw: Record<string, GridValue> }

const BLANK = "(Blank)"

const ROW_TONES: Record<NonNullable<GridTone>, string> = {
  active: "bg-paid-muted",
  expiring: "bg-pending-muted",
  expired: "bg-overdue-muted",
  check: "bg-orange-500/15",
}
// A pinned cell needs an opaque background, or the columns scrolling under it
// show through; the tint is painted over that background.
const PINNED_TONES: Record<NonNullable<GridTone>, string> = {
  active: "before:bg-paid-muted",
  expiring: "before:bg-pending-muted",
  expired: "before:bg-overdue-muted",
  check: "before:bg-orange-500/15",
}

const kindOf = <Row,>(column: GridColumn<Row>): GridKind => column.kind ?? "text"
const isBlank = (value: GridValue) => value === null || value === undefined || value === ""
const hasRange = (kind: GridKind) => kind === "date" || kind === "datetime" || kind === "money" || kind === "number"

/** The value as a person reads it; also what the funnel's tick-list and the search match. */
export function labelOf(kind: GridKind, value: GridValue): string {
  if (isBlank(value)) return BLANK
  switch (kind) {
    case "yesno":
      return value ? "Yes" : "No"
    case "date":
      return formatDate(String(value))
    case "datetime":
      // Grouped by day, like Excel's date filter; the cell still shows the time.
      return formatDate(toISTDateString(new Date(String(value))))
    case "money":
      return formatINR(Number(value))
    default:
      return String(value)
  }
}

/** The value as the download writes it: plain, sortable in Excel. */
function csvOf(kind: GridKind, value: GridValue): string {
  if (isBlank(value)) return ""
  switch (kind) {
    case "yesno":
      return value ? "Yes" : "No"
    case "date":
      return String(value).slice(0, 10)
    case "datetime":
      return formatIST(String(value), "yyyy-MM-dd HH:mm")
    case "money":
      return (Number(value) / 100).toFixed(2)
    default:
      return String(value)
  }
}

/** What sorting compares. Blanks sort last whichever way the column is sorted. */
function sortKey(kind: GridKind, value: GridValue): SortKey {
  if (isBlank(value)) return null
  switch (kind) {
    case "yesno":
      return value ? 1 : 0
    case "money":
    case "number":
      return Number(value)
    case "date":
      return String(value).slice(0, 10)
    case "datetime":
      return String(value)
    default:
      return String(value).toLocaleLowerCase()
  }
}

/** A date or amount reduced to what from/to compares: "yyyy-mm-dd" or rupees. */
function rangeKey(kind: GridKind, value: GridValue): number | string | null {
  if (isBlank(value)) return null
  switch (kind) {
    case "date":
      return String(value).slice(0, 10)
    case "datetime":
      return toISTDateString(new Date(String(value)))
    case "money":
      return Number(value) / 100
    case "number":
      return Number(value)
    default:
      return null
  }
}

function passesRange(kind: GridKind, value: GridValue, filter: ColumnFilter): boolean {
  if (!filter.from && !filter.to) return true
  const key = rangeKey(kind, value)
  if (key === null) return false
  if (typeof key === "number") {
    if (filter.from && key < Number(filter.from)) return false
    if (filter.to && key > Number(filter.to)) return false
    return true
  }
  if (filter.from && key < filter.from) return false
  if (filter.to && key > filter.to) return false
  return true
}

function compare(a: SortKey, b: SortKey, dir: Dir): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  const result = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b))
  return dir === "asc" ? result : -result
}

/** The rows that pass the search and every column filter except `except`. */
function visibleRows<Row>(
  entries: Entry<Row>[],
  columns: GridColumn<Row>[],
  filters: Record<string, ColumnFilter>,
  needle: string,
  except: string | null
): Entry<Row>[] {
  const filterable = columns.filter((c) => !c.plain)
  // A search of digits only also matches a phone number written with spaces.
  const digits = /^\d+$/.test(needle) ? needle : null
  return entries.filter((entry) => {
    if (needle) {
      const hit = filterable.some((column) => {
        const value = entry.raw[column.id]
        const label = entry.labels[column.id]
        return (
          label.toLocaleLowerCase().includes(needle) ||
          (typeof value === "string" && value.toLocaleLowerCase().includes(needle)) ||
          (digits !== null && label.replace(/\D/g, "").includes(digits))
        )
      })
      if (!hit) return false
    }
    return filterable.every((column) => {
      if (column.id === except) return true
      const filter = filters[column.id]
      if (!filter) return true
      if (filter.values && !filter.values.includes(entry.labels[column.id])) return false
      return passesRange(kindOf(column), entry.raw[column.id], filter)
    })
  })
}

function csvLine(fields: string[]): string {
  return fields.map((f) => (/[",\n\r]/.test(f) ? `"${f.replace(/"/g, '""')}"` : f)).join(",")
}

export type GridProps<Row> = {
  columns: GridColumn<Row>[]
  rows: Row[]
  rowKey: (row: Row) => string
  rowTone?: (row: Row) => GridTone
  /** What the rows are called in the bar: "customers", "purchases". */
  noun: string
  /** File name for the download, without ".csv". */
  downloadName: string
  initialSort?: Sort
  /** Column id -> the labels to start ticked, e.g. { status: ["Expiring soon"] }. */
  initialFilters?: Record<string, string[] | undefined>
  initialSearch?: string
  emptyMessage?: string
}

export function Grid<Row>({
  columns,
  rows,
  rowKey,
  rowTone,
  noun,
  downloadName,
  initialSort,
  initialFilters,
  initialSearch,
  emptyMessage = "Nothing to show yet.",
}: GridProps<Row>) {
  const [sort, setSort] = useState<Sort | null>(initialSort ?? null)
  const [filters, setFilters] = useState<Record<string, ColumnFilter>>(() => {
    const out: Record<string, ColumnFilter> = {}
    for (const [id, values] of Object.entries(initialFilters ?? {})) {
      if (values && values.length) out[id] = { values }
    }
    return out
  })
  const [search, setSearch] = useState(initialSearch ?? "")
  // The open funnel menu, placed under its button (fixed, so the grid's own
  // scrolling never clips it).
  const [menu, setMenu] = useState<{ id: string; top: number; left: number; right: number } | null>(null)

  // Each row's labels once, so filtering, searching and the tick-lists share them.
  const entries = useMemo<Entry<Row>[]>(
    () =>
      rows.map((row) => {
        const labels: Record<string, string> = {}
        const raw: Record<string, GridValue> = {}
        for (const column of columns) {
          if (column.plain) continue
          const value = column.value(row)
          raw[column.id] = value
          labels[column.id] = labelOf(kindOf(column), value)
        }
        return { row, labels, raw }
      }),
    [rows, columns]
  )

  const needle = search.trim().toLocaleLowerCase()

  const shown = useMemo(() => {
    const list = visibleRows(entries, columns, filters, needle, null)
    if (sort) {
      const column = columns.find((c) => c.id === sort.id)
      if (column) {
        const kind = kindOf(column)
        list.sort((a, b) => compare(sortKey(kind, a.raw[column.id]), sortKey(kind, b.raw[column.id]), sort.dir))
      }
    }
    return list
  }, [entries, columns, filters, needle, sort])

  const activeFilters = Object.values(filters).filter((f) => f.values || f.from || f.to).length

  const sums = columns
    .filter((c) => c.sum)
    .map((column) => ({
      column,
      total: shown.reduce((sum, entry) => sum + (Number(entry.raw[column.id]) || 0), 0),
    }))

  function download() {
    const exportColumns = columns.filter((c) => !c.plain)
    const lines = [csvLine(exportColumns.map((c) => c.header))]
    for (const entry of shown) lines.push(csvLine(exportColumns.map((c) => csvOf(kindOf(c), entry.raw[c.id]))))
    // A byte-order mark, so Excel reads the file as UTF-8 (names with accents, the rupee sign).
    const blob = new Blob([`\uFEFF${lines.join("\r\n")}\r\n`], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${downloadName}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function toggleSort(id: string) {
    setSort((current) => (current?.id === id ? (current.dir === "asc" ? { id, dir: "desc" } : null) : { id, dir: "asc" }))
  }

  function openMenu(column: GridColumn<Row>, button: HTMLElement) {
    if (menu?.id === column.id) return setMenu(null)
    const rect = button.getBoundingClientRect()
    setMenu({ id: column.id, top: rect.bottom + 4, left: rect.left, right: window.innerWidth - rect.right })
  }

  const menuColumn = menu ? columns.find((c) => c.id === menu.id) : undefined

  return (
    <div className="space-y-3">
      {/* ---- the bar: search, what matched, totals, download ---- */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:px-6">
        <label className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search everything"
            aria-label="Search"
            className="h-9 w-56 rounded-lg border border-border/80 bg-card pr-3 pl-8 text-sm text-foreground outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20"
          />
        </label>
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">{shown.length}</span>
          {shown.length !== rows.length ? <> of {rows.length}</> : null} {noun}
          {sums.map(({ column, total }) => (
            <span key={column.id}>
              {" "}
              · {column.header}{" "}
              <span className="font-semibold text-foreground tabular-nums">
                {kindOf(column) === "money" ? formatINR(total, { paise: false }) : total}
              </span>
            </span>
          ))}
        </p>
        <div className="ml-auto flex items-center gap-2">
          {activeFilters || needle ? (
            <button
              type="button"
              onClick={() => {
                setFilters({})
                setSearch("")
              }}
              className="inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden />
              Clear {activeFilters ? `${activeFilters} filter${activeFilters === 1 ? "" : "s"}` : "search"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={download}
            disabled={shown.length === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium hover:bg-secondary/70 disabled:opacity-50"
            title="A CSV of the rows shown, in this order, with these filters"
          >
            <Download className="size-4" aria-hidden />
            Download shown rows
          </button>
        </div>
      </div>

      {/* ---- the grid ---- */}
      <div className="mx-4 overflow-x-auto rounded-xl border border-border/80 bg-card sm:mx-6">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              {columns.map((column) => {
                const filter = filters[column.id]
                const active = Boolean(filter && (filter.values || filter.from || filter.to))
                const sorted = sort?.id === column.id ? sort.dir : null
                return (
                  <th
                    key={column.id}
                    scope="col"
                    className={cn(
                      "border-b border-border/80 bg-secondary/60 px-2 py-1.5 text-left text-xs font-semibold whitespace-nowrap text-muted-foreground",
                      column.align === "right" && "text-right",
                      column.pinned && "sticky left-0 z-20 bg-secondary"
                    )}
                  >
                    {column.plain ? (
                      <span className="px-1">{column.header}</span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => toggleSort(column.id)}
                          className="inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground"
                          title="Sort"
                        >
                          {column.header}
                          {sorted === "asc" ? (
                            <ArrowUp className="size-3" aria-label="sorted ascending" />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="size-3" aria-label="sorted descending" />
                          ) : null}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => openMenu(column, e.currentTarget)}
                          aria-expanded={menu?.id === column.id}
                          aria-label={`Filter ${column.header}`}
                          className={cn(
                            "inline-flex size-6 items-center justify-center rounded hover:bg-secondary hover:text-foreground",
                            active && "bg-primary/15 text-primary"
                          )}
                        >
                          <Filter className="size-3" fill={active ? "currentColor" : "none"} aria-hidden />
                        </button>
                      </span>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-muted-foreground">
                  {rows.length === 0 ? emptyMessage : "No rows match these filters."}
                </td>
              </tr>
            ) : (
              shown.map((entry) => {
                const tone = rowTone?.(entry.row) ?? null
                return (
                  <tr key={rowKey(entry.row)} className={cn(tone && ROW_TONES[tone])}>
                    {columns.map((column) => (
                      <td
                        key={column.id}
                        className={cn(
                          // Positioned, so anything absolutely placed inside a
                          // cell (a hidden checkbox, say) stays inside the
                          // scrolling grid instead of widening the page.
                          "border-b border-border/50 px-3 py-1.5 whitespace-nowrap align-middle",
                          column.align === "right" && "text-right tabular-nums",
                          column.pinned
                            ? "sticky left-0 z-10 bg-card before:absolute before:inset-0 before:-z-10 before:content-['']"
                            : "relative",
                          column.pinned && tone && PINNED_TONES[tone]
                        )}
                      >
                        {column.cell ? column.cell(entry.row) : <Plain kind={kindOf(column)} value={column.value(entry.row)} />}
                      </td>
                    ))}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {menu && menuColumn ? (
        <FilterMenu
          key={menu.id}
          column={menuColumn}
          position={menu}
          filter={filters[menu.id] ?? {}}
          candidates={visibleRows(entries, columns, filters, needle, menu.id).map((entry) => ({
            label: entry.labels[menu.id],
            key: sortKey(kindOf(menuColumn), entry.raw[menu.id]),
          }))}
          sorted={sort?.id === menu.id ? sort.dir : null}
          onSort={(dir) => {
            setSort({ id: menu.id, dir })
            setMenu(null)
          }}
          onChange={(next) =>
            setFilters((current) => {
              const copy = { ...current }
              if (!next.values && !next.from && !next.to) delete copy[menu.id]
              else copy[menu.id] = next
              return copy
            })
          }
          onClose={() => setMenu(null)}
        />
      ) : null}
    </div>
  )
}

/** The default cell: the value formatted for its kind. */
function Plain({ kind, value }: { kind: GridKind; value: GridValue }) {
  if (isBlank(value)) return <span className="text-muted-foreground">—</span>
  if (kind === "datetime") return <span className="text-muted-foreground">{formatIST(String(value))}</span>
  return <>{labelOf(kind, value)}</>
}

/** Excel's funnel menu: sort, a from/to for dates and amounts, and the tick-list of values. */
function FilterMenu<Row>({
  column,
  position,
  filter,
  candidates,
  sorted,
  onSort,
  onChange,
  onClose,
}: {
  column: GridColumn<Row>
  position: { top: number; left: number; right: number }
  filter: ColumnFilter
  /** This column's label on every row the other filters let through. */
  candidates: { label: string; key: SortKey }[]
  sorted: Dir | null
  onSort: (dir: Dir) => void
  onChange: (next: ColumnFilter) => void
  onClose: () => void
}) {
  const kind = kindOf(column)
  const ref = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState("")

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose()
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKey)
    window.addEventListener("resize", onClose)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKey)
      window.removeEventListener("resize", onClose)
    }
  }, [onClose])

  // Distinct values with how many rows carry each, in the column's own order, blanks last.
  const options = useMemo(() => {
    const seen = new Map<string, { label: string; key: SortKey; count: number }>()
    for (const { label, key } of candidates) {
      const option = seen.get(label)
      if (option) option.count += 1
      else seen.set(label, { label, key, count: 1 })
    }
    return [...seen.values()].sort((a, b) => compare(a.key, b.key, "asc"))
  }, [candidates])

  const q = query.trim().toLocaleLowerCase()
  const visible = q ? options.filter((o) => o.label.toLocaleLowerCase().includes(q)) : options
  const ticked = new Set(filter.values ?? options.map((o) => o.label))
  const allVisibleTicked = visible.length > 0 && visible.every((o) => ticked.has(o.label))

  function setTicked(next: Set<string>) {
    // Everything ticked means no filter on this column.
    const everything = options.every((o) => next.has(o.label))
    onChange({ ...filter, values: everything ? undefined : [...next] })
  }

  const [lowLabel, highLabel] =
    kind === "date" || kind === "datetime"
      ? ["Oldest first", "Newest first"]
      : kind === "number" || kind === "money"
        ? ["Smallest first", "Largest first"]
        : ["A → Z", "Z → A"]
  const inputType = kind === "date" || kind === "datetime" ? "date" : "number"
  const inputClass =
    "mt-0.5 h-8 w-full rounded-md border border-border/80 bg-card px-2 text-xs text-foreground outline-none focus-visible:border-primary/50"

  // Open to the left when the button sits near the right edge.
  const style: React.CSSProperties =
    position.left + 272 > window.innerWidth
      ? { position: "fixed", top: position.top, right: Math.max(8, position.right) }
      : { position: "fixed", top: position.top, left: position.left }

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Filter ${column.header}`}
      style={style}
      className="z-50 w-64 rounded-xl border border-border bg-popover p-2 text-left text-sm font-normal text-popover-foreground shadow-lg"
    >
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => onSort("asc")}
          className={cn("flex-1 rounded-md px-2 py-1 text-left text-xs hover:bg-secondary", sorted === "asc" && "bg-secondary font-semibold")}
        >
          <ArrowUp className="mr-1 inline size-3" aria-hidden />
          {lowLabel}
        </button>
        <button
          type="button"
          onClick={() => onSort("desc")}
          className={cn("flex-1 rounded-md px-2 py-1 text-left text-xs hover:bg-secondary", sorted === "desc" && "bg-secondary font-semibold")}
        >
          <ArrowDown className="mr-1 inline size-3" aria-hidden />
          {highLabel}
        </button>
      </div>

      {hasRange(kind) ? (
        <div className="mt-2 grid grid-cols-2 gap-1">
          <label className="text-[0.6875rem] text-muted-foreground">
            From{kind === "money" ? " (₹)" : ""}
            <input
              type={inputType}
              value={filter.from ?? ""}
              onChange={(e) => onChange({ ...filter, from: e.target.value || undefined })}
              className={inputClass}
            />
          </label>
          <label className="text-[0.6875rem] text-muted-foreground">
            To{kind === "money" ? " (₹)" : ""}
            <input
              type={inputType}
              value={filter.to ?? ""}
              onChange={(e) => onChange({ ...filter, to: e.target.value || undefined })}
              className={inputClass}
            />
          </label>
        </div>
      ) : null}

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search values"
        aria-label={`Search ${column.header} values`}
        autoFocus
        className={cn(inputClass, "mt-2")}
      />

      <label className="mt-1.5 flex items-center gap-2 rounded-md px-1.5 py-1 text-xs font-medium hover:bg-secondary">
        <input
          type="checkbox"
          aria-label="Select all"
          checked={allVisibleTicked}
          onChange={() => {
            const next = new Set(ticked)
            for (const o of visible) {
              if (allVisibleTicked) next.delete(o.label)
              else next.add(o.label)
            }
            setTicked(next)
          }}
          className="size-3.5 accent-primary"
        />
        (Select all{q ? " search results" : ""})
      </label>
      <ul className="max-h-56 overflow-y-auto">
        {visible.length === 0 ? <li className="px-1.5 py-1 text-xs text-muted-foreground">No values match.</li> : null}
        {visible.map((o) => (
          <li key={o.label}>
            <label className="flex items-center gap-2 rounded-md px-1.5 py-1 text-xs hover:bg-secondary">
              <input
                type="checkbox"
                aria-label={o.label}
                checked={ticked.has(o.label)}
                onChange={() => {
                  const next = new Set(ticked)
                  if (next.has(o.label)) next.delete(o.label)
                  else next.add(o.label)
                  setTicked(next)
                }}
                className="size-3.5 accent-primary"
              />
              <span className="min-w-0 flex-1 truncate">{o.label}</span>
              <span className="text-muted-foreground tabular-nums">{o.count}</span>
            </label>
          </li>
        ))}
      </ul>

      {filter.values || filter.from || filter.to ? (
        <button
          type="button"
          onClick={() => onChange({})}
          className="mt-1.5 w-full rounded-md px-2 py-1 text-left text-xs text-primary hover:bg-secondary"
        >
          Clear filter on {column.header}
        </button>
      ) : null}
    </div>
  )
}
