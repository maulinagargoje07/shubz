"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  type LeadStatus,
} from "@/lib/leads"
import { setLeadStatus } from "@/server/leads/actions"

/**
 * Change one lead's status from the list, without opening it.
 *
 * Working a lead list is a fast, repetitive job — call, mark, next — so the
 * status is editable in place. A native select is used deliberately: on a phone
 * it opens the platform picker, which is one tap and reachable one-handed,
 * where a custom menu would be neither.
 */
export function LeadStatusPicker({
  contactId,
  status,
}: {
  contactId: string
  status: LeadStatus
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  // Held locally so the select reflects the choice immediately; the server is
  // still the authority, and a failure puts the old value back.
  const [value, setValue] = useState<LeadStatus>(status)

  function onChange(next: LeadStatus) {
    const previous = value
    setValue(next)

    startTransition(async () => {
      const result = await setLeadStatus({ contactId, status: next })
      if (!result.ok) {
        setValue(previous)
        toast.error(result.error)
        return
      }
      toast.success(`Marked ${LEAD_STATUS_LABELS[next].toLowerCase()}`)
      router.refresh()
    })
  }

  return (
    <select
      aria-label="Lead status"
      value={value}
      disabled={pending}
      onChange={(event) => onChange(event.target.value as LeadStatus)}
      className="h-9 rounded-lg border border-border/80 bg-card px-2 text-xs outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20 disabled:opacity-60"
    >
      {LEAD_STATUSES.map((option) => (
        <option key={option} value={option}>
          {LEAD_STATUS_LABELS[option]}
        </option>
      ))}
    </select>
  )
}
