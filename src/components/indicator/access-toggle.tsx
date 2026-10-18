"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Check } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"

import { StatusPill } from "@/components/ui/status"
import type { AccessAction } from "@/lib/indicator"
import { updateTradingViewAccess } from "@/server/indicator/actions"

/**
 * The "TradingView access given" tick.
 *
 * An admin adds the buyer's username to the indicator on TradingView, then
 * ticks this. The tick shows straight away and is saved in the background; if
 * the save fails it springs back and says why. When a subscriber stops paying,
 * the row asks for the tick to come off again once access has been removed.
 */
export function AccessToggle({
  subscriptionId,
  name,
  granted,
  action,
  updatedBy,
  updatedLabel,
  canEdit,
  hideAction = false,
}: {
  subscriptionId: string
  name: string
  granted: boolean
  action: AccessAction
  updatedBy: string | null
  /** When it was last ticked or unticked, already formatted on the server. */
  updatedLabel: string | null
  canEdit: boolean
  /** Leave out the "Needs access/removal" pill where the list already says it. */
  hideAction?: boolean
}) {
  const router = useRouter()
  const [optimistic, setOptimistic] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)

  // Fresh data from the server wins over the guess made on click.
  useEffect(() => {
    setOptimistic(null)
  }, [granted])

  const checked = optimistic ?? granted
  // The ask follows the tick: "remove" only matters while it is still ticked.
  const shownAction: AccessAction = hideAction
    ? null
    : action === "grant" && !checked
      ? "grant"
      : action === "remove" && checked
        ? "remove"
        : null

  async function toggle() {
    if (!canEdit || saving) return
    const next = !checked
    setOptimistic(next)
    setSaving(true)
    const result = await updateTradingViewAccess({ subscriptionId, granted: next })
    setSaving(false)

    if (!result.ok) {
      setOptimistic(null)
      toast.error(result.error)
      return
    }
    toast.success(
      next ? `Marked: ${name} has TradingView access` : `Marked: ${name}'s TradingView access removed`
    )
    router.refresh()
  }

  if (!canEdit) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <StatusPill tone={checked ? "paid" : "muted"}>{checked ? "Access given" : "No access"}</StatusPill>
        {shownAction ? <ActionPill action={shownAction} /> : null}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {shownAction ? <ActionPill action={shownAction} /> : null}
        <label
          className={cn(
            "inline-flex cursor-pointer select-none items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors pointer-coarse:min-h-11",
            checked
              ? "border-paid/40 bg-paid-muted text-paid-foreground"
              : "border-border bg-card hover:bg-secondary/70",
            saving && "cursor-wait opacity-70"
          )}
        >
          <input
            type="checkbox"
            className="peer sr-only"
            checked={checked}
            disabled={saving}
            onChange={toggle}
            aria-label={`TradingView access given for ${name}`}
          />
          <span
            aria-hidden
            className={cn(
              "flex size-4 shrink-0 items-center justify-center rounded border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring/70 peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-background",
              checked ? "border-paid bg-paid text-black" : "border-muted-foreground/60"
            )}
          >
            {checked ? <Check className="size-3" strokeWidth={3.5} /> : null}
          </span>
          <span className="whitespace-nowrap">{saving ? "Saving…" : "Access given"}</span>
        </label>
      </div>
      {checked && updatedBy && !saving ? (
        <p className="text-[0.6875rem] text-muted-foreground">
          by {updatedBy}
          {updatedLabel ? ` · ${updatedLabel}` : ""}
        </p>
      ) : null}
    </div>
  )
}

function ActionPill({ action }: { action: Exclude<AccessAction, null> }) {
  return action === "grant" ? (
    <StatusPill tone="pending">Needs access</StatusPill>
  ) : (
    <StatusPill tone="overdue">Needs removal</StatusPill>
  )
}
