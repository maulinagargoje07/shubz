/**
 * List filtering and pagination — SERVER components.
 *
 * Both were client components that pushed router state on every keystroke and
 * change. They are now a plain HTML `<form method="get">` and plain links.
 * That removes them from the client bundle entirely and, as a side effect,
 * makes filtering work before hydration and on a flaky connection.
 *
 * Selects are native `<select>` elements rather than a JS-rendered listbox.
 * On a phone that is the meaningful upgrade: a native select opens the
 * platform's own wheel picker, which is faster, reachable one-handed, and
 * already familiar. `onchange`-submits are avoided so the control stays
 * scriptless — an explicit Apply button submits the whole form at once, which
 * is also fewer round-trips when changing two filters together.
 */

import Link from "next/link"
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"

export type FilterOption = { value: string; label: string }

export type FilterSpec = {
  /** Search-param key this control reads and writes. */
  key: string
  label: string
  options: FilterOption[]
  /**
   * Optional group heading per option, rendered as <optgroup>.
   *
   * Batch names repeat across programs — "B1" exists under several — so a flat
   * list would offer the same label several times with no way to tell them
   * apart. Grouping by program makes the choice unambiguous.
   */
  groupBy?: (option: FilterOption) => string | undefined
}

/**
 * Bucket options by their group, preserving the order they arrived in so the
 * caller controls sorting. Ungrouped options come back under an empty key and
 * render loose, above the groups.
 */
function groupOptions(
  options: FilterOption[],
  groupBy: (option: FilterOption) => string | undefined
): [string, FilterOption[]][] {
  const buckets = new Map<string, FilterOption[]>()
  for (const option of options) {
    const key = groupBy(option) ?? ""
    const bucket = buckets.get(key)
    if (bucket) bucket.push(option)
    else buckets.set(key, [option])
  }
  return [...buckets.entries()]
}

export function FilterBar({
  action,
  params,
  searchPlaceholder,
  filters = [],
  showSearch = true,
  children,
}: {
  /** The list route this form submits back to. */
  action: string
  /** Current search params, so controls render with their active values. */
  params: Record<string, string | undefined>
  searchPlaceholder?: string
  filters?: FilterSpec[]
  showSearch?: boolean
  children?: React.ReactNode
}) {
  const hasActive =
    Boolean(params.q) || filters.some((filter) => Boolean(params[filter.key]))

  return (
    <form
      action={action}
      method="get"
      className="flex flex-col gap-2.5 px-4 pb-4 sm:flex-row sm:flex-wrap sm:items-end sm:px-6"
    >
      <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        {showSearch ? (
          <div className="relative w-full min-w-0 sm:max-w-72 sm:flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              type="search"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder ?? "Search"}
              className="h-10 w-full rounded-lg border border-border/80 bg-card pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20"
            />
          </div>
        ) : null}

        {filters.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            {filters.map((filter) => (
              <label key={filter.key} className="min-w-0">
                <span className="sr-only">{filter.label}</span>
                <select
                  name={filter.key}
                  defaultValue={params[filter.key] ?? ""}
                  className="h-10 w-full rounded-lg border border-border/80 bg-card px-3 text-sm text-foreground outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20"
                >
                  <option value="">All {filter.label.toLowerCase()}</option>
                  {filter.groupBy
                    ? groupOptions(filter.options, filter.groupBy).map(
                        ([group, options]) =>
                          group ? (
                            <optgroup key={group} label={group}>
                              {options.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </optgroup>
                          ) : (
                            options.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))
                          )
                      )
                    : filter.options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                </select>
              </label>
            ))}
          </div>
        ) : null}

        {children}
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="submit"
          size="sm"
          className="h-10 flex-1 bg-primary text-primary-foreground font-semibold hover:bg-primary/90 active:scale-95 sm:flex-none"
        >
          Apply
        </Button>

        {hasActive ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-10 text-muted-foreground hover:text-foreground active:scale-95"
            render={<Link href={action} />}
          >
            <X className="size-4" />
            Clear
          </Button>
        ) : null}
      </div>
    </form>
  )
}

/**
 * Pagination as links, so a page is reachable without JavaScript and the
 * browser can prefetch the next one.
 */
export function Pagination({
  action,
  params,
  page,
  perPage,
  total,
}: {
  action: string
  params: Record<string, string | undefined>
  page: number
  perPage: number
  total: number
}) {
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const from = total === 0 ? 0 : (page - 1) * perPage + 1
  const to = Math.min(page * perPage, total)

  const hrefFor = (nextPage: number) => {
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== "page") search.set(key, value)
    }
    if (nextPage > 1) search.set("page", String(nextPage))
    const query = search.toString()
    return query ? `${action}?${query}` : action
  }

  if (total === 0) return null

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 text-sm sm:px-6"
      aria-label="Pagination"
    >
      <p className="text-muted-foreground">
        <span className="font-medium text-foreground">{from}</span>–
        <span className="font-medium text-foreground">{to}</span> of{" "}
        <span className="font-medium text-foreground">{total}</span>
      </p>

      {totalPages > 1 ? (
        <div className="flex items-center gap-1.5">
          <PageLink href={hrefFor(page - 1)} disabled={page <= 1} label="Previous">
            <ChevronLeft className="size-4" />
            <span className="hidden sm:inline">Previous</span>
          </PageLink>

          <span className="px-1 text-muted-foreground">
            {page} / {totalPages}
          </span>

          <PageLink href={hrefFor(page + 1)} disabled={page >= totalPages} label="Next">
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="size-4" />
          </PageLink>
        </div>
      ) : null}
    </nav>
  )
}

function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string
  disabled: boolean
  label: string
  children: React.ReactNode
}) {
  const className = cn(
    "inline-flex h-9 items-center gap-1 rounded-lg border px-3 text-sm transition-colors",
    disabled
      ? "pointer-events-none opacity-40"
      : "hover:bg-accent hover:text-accent-foreground"
  )

  // A disabled control must not be a link at all, or it stays keyboard-reachable
  // and screen readers still announce it as navigable.
  if (disabled) {
    return (
      <span className={className} aria-disabled="true">
        {children}
      </span>
    )
  }

  return (
    <Link href={href} className={className} aria-label={label}>
      {children}
    </Link>
  )
}
