"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, RefreshCcw } from "lucide-react"
import { toast } from "sonner"

import type { IndicatorMode } from "@/lib/indicator"
import { backfillMeetupAction } from "@/server/indicator/meetup-actions"

/**
 * "Check Razorpay for missed registrations": asks the payments service to
 * read the Payment Page's payments of the last 30 days from Razorpay and save
 * any it never heard about (tickets sold before the webhook events were
 * switched on). Shown to superadmins only; the server checks again.
 */
export function MeetupBackfillButton({ mode }: { mode: IndicatorMode }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function run() {
    if (busy) return
    setBusy(true)
    const result = await backfillMeetupAction({ mode })
    setBusy(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    const r = result.data
    toast.success(
      r.inserted > 0 ? `${r.inserted} missed ${r.inserted === 1 ? "registration" : "registrations"} added` : "Nothing was missing",
      {
        description: `Razorpay listed ${r.scanned} ${r.scanned === 1 ? "payment" : "payments"} in the last 30 days; ${r.matched} from the meetup page${
          r.unmatchedTotal ? `, ${r.unmatchedTotal} from elsewhere` : ""
        }.`,
        duration: 10_000,
      }
    )
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      className="glass-tint press inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-glass-hover disabled:cursor-wait disabled:opacity-70"
      title="Reads the meetup page's payments of the last 30 days from Razorpay and adds any that are missing here"
    >
      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCcw className="size-4" aria-hidden />}
      {busy ? "Asking Razorpay…" : "Check Razorpay for missed registrations"}
    </button>
  )
}
