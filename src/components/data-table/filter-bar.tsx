"use client"

/**
 * Search and filter controls that write to URL search params.
 *
 * Search is debounced so typing does not fire a server round-trip per
 * keystroke; changing a filter resets to page 1, because staying on page 7 of
 * a narrower result set usually lands on nothing.
 */

import { useEffect, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type FilterOption = { value: string; label: string }

export type FilterSpec = {
  /** Search-param key this control writes. */
  key: string
  label: string
  options: FilterOption[]
}

export function FilterBar({
  searchPlaceholder = "Search…",
  filters = [],
  showSearch = true,
}: {
  searchPlaceholder?: string
  filters?: FilterSpec[]
  showSearch?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const [query, setQuery] = useState(searchParams.get("q") ?? "")

  // Keep the input in step when the URL changes from elsewhere (back button).
  useEffect(() => {
    setQuery(searchParams.get("q") ?? "")
  }, [searchParams])

  function apply(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString())
    mutate(params)
    // A changed filter invalidates the current page number.
    params.delete("page")
    startTransition(() => {
      router.push(params.size ? `${pathname}?${params}` : pathname)
    })
  }

  useEffect(() => {
    const current = searchParams.get("q") ?? ""
    if (query === current) return

    const timer = setTimeout(() => {
      apply((params) => {
        if (query) params.set("q", query)
        else params.delete("q")
      })
    }, 300)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const activeFilters = filters.filter((f) => searchParams.get(f.key))
  const hasAny = activeFilters.length > 0 || (searchParams.get("q") ?? "") !== ""

  return (
    <div className="flex flex-wrap items-center gap-2 px-6 py-4">
      {showSearch ? (
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-8"
            aria-label={searchPlaceholder}
          />
        </div>
      ) : null}

      {filters.map((filter) => {
        const value = searchParams.get(filter.key) ?? "__all"
        return (
          <Select
            key={filter.key}
            value={value}
            onValueChange={(next: string | null) =>
              apply((params) => {
                if (!next || next === "__all") params.delete(filter.key)
                else params.set(filter.key, next)
              })
            }
          >
            <SelectTrigger className="w-auto min-w-40">
              <SelectValue placeholder={filter.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All {filter.label.toLowerCase()}</SelectItem>
              {filter.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      })}

      {hasAny ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => startTransition(() => router.push(pathname))}
        >
          <X className="size-4" />
          Clear
        </Button>
      ) : null}
    </div>
  )
}
