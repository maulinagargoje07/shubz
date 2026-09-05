"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/** Date-range filter that writes to the URL, like every other list filter. */
export function DateRangeFilter() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function set(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    params.delete("page")
    router.push(`${pathname}?${params}`)
  }

  return (
    <div className="flex flex-wrap items-end gap-3 px-6 pb-4">
      <div className="grid gap-1.5">
        <Label htmlFor="from" className="text-xs text-muted-foreground">
          From
        </Label>
        <Input
          id="from"
          type="date"
          className="w-auto"
          value={searchParams.get("from") ?? ""}
          onChange={(e) => set("from", e.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="to" className="text-xs text-muted-foreground">
          To
        </Label>
        <Input
          id="to"
          type="date"
          className="w-auto"
          value={searchParams.get("to") ?? ""}
          onChange={(e) => set("to", e.target.value)}
        />
      </div>
    </div>
  )
}
