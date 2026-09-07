"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Download, ListPlus, Tags } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  LEAD_STATUSES,
  LEAD_STATUS_DESCRIPTIONS,
  LEAD_STATUS_LABELS,
  type LeadStatus,
} from "@/lib/leads"
import { bulkSetLeadStatus, bulkTagLeads } from "@/server/leads/actions"

type Filters = {
  q?: string
  status?: LeadStatus
  source?: string
  list?: string
  experience?: string
  from?: string
  to?: string
  includeConverted?: boolean
}

/**
 * Act on every lead matching the current filters.
 *
 * Bulk work is expressed against the filter rather than against ticked rows.
 * That is how the job is actually described — "mark the whole September webinar
 * list as contacted" — and unlike a checkbox selection it covers leads on pages
 * you never scrolled to. It is also exactly the selection a campaign will need
 * to send to, so building the segment here is the same act as building it for
 * messaging later.
 *
 * The count is sent along and re-checked on the server, so if the list has
 * moved since the page rendered the action stops rather than silently touching
 * a different set of people.
 */
export function LeadBulkActions({
  filters,
  count,
  filtered,
  exportHref,
}: {
  filters: Filters
  count: number
  filtered: boolean
  exportHref: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [statusOpen, setStatusOpen] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const [listName, setListName] = useState("")

  const scope = filtered ? `all ${count} matching` : `all ${count}`

  function applyStatus(status: LeadStatus) {
    startTransition(async () => {
      const result = await bulkSetLeadStatus({ filters, status, expectedCount: count })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(
        `${result.data.updated} lead${result.data.updated === 1 ? "" : "s"} marked ${LEAD_STATUS_LABELS[
          status
        ].toLowerCase()}`
      )
      setStatusOpen(false)
      router.refresh()
    })
  }

  function applyList() {
    const name = listName.trim()
    if (!name) {
      toast.error("Give the list a name")
      return
    }
    startTransition(async () => {
      const result = await bulkTagLeads({ filters, listName: name, expectedCount: count })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(`${result.data.tagged} added to “${result.data.listName}”`)
      setListName("")
      setListOpen(false)
      router.refresh()
    })
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-border/80 bg-secondary/40 px-3 py-2.5">
      <p className="min-w-0 flex-1 text-sm">
        <span className="font-semibold">{count}</span>{" "}
        {filtered ? "leads match these filters" : "leads"}
      </p>

      {/* Change the status of everything currently matched. */}
      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogTrigger
          render={
            <Button size="sm" variant="outline" disabled={pending}>
              <Tags className="size-4" />
              Set status
            </Button>
          }
        />
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set status for {scope} leads</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {LEAD_STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                disabled={pending}
                onClick={() => applyStatus(status)}
                className="block w-full rounded-lg border border-border/80 px-3 py-2.5 text-left transition-colors hover:bg-accent disabled:opacity-60"
              >
                <span className="block text-sm font-medium">
                  {LEAD_STATUS_LABELS[status]}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {LEAD_STATUS_DESCRIPTIONS[status]}
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Name this segment, which is what a campaign will later send to. */}
      <Dialog open={listOpen} onOpenChange={setListOpen}>
        <DialogTrigger
          render={
            <Button size="sm" variant="outline" disabled={pending}>
              <ListPlus className="size-4" />
              Add to list
            </Button>
          }
        />
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add {scope} leads to a list</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="bulk-list-name">List name</Label>
              <Input
                id="bulk-list-name"
                value={listName}
                onChange={(event) => setListName(event.target.value)}
                placeholder="Webinar 12 Sep"
                autoComplete="off"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                An existing list of the same name is added to rather than duplicated.
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={applyList} disabled={pending}>
                {pending ? "Adding…" : `Add ${count}`}
              </Button>
              <Button variant="outline" onClick={() => setListOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/*
        Until the built-in campaign sender exists, the export is how a segment
        reaches a messaging tool — so it carries the same filters as the view.
      */}
      <Button size="sm" variant="ghost" render={<Link href={exportHref} />}>
        <Download className="size-4" />
        Export
      </Button>
    </div>
  )
}
