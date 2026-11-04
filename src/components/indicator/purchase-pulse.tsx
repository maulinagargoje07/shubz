"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"

import { formatINR } from "@/lib/money"

/**
 * A toast the moment a new purchase lands while the dashboard is open.
 *
 * The dashboard refreshes itself every few seconds; this sees the list of
 * latest payments change, works out which payment IDs it hasn't seen before,
 * and says so. The first render only takes note of what is already there, so
 * reloading the page never announces old news.
 */
export type PulsePayment = {
  paymentId: string
  fullName: string
  amountPaise: number
  plan: string | null
  renewal: boolean
}

export function PurchasePulse({ payments }: { payments: PulsePayment[] }) {
  const seen = useRef<Set<string> | null>(null)

  useEffect(() => {
    if (seen.current === null) {
      seen.current = new Set(payments.map((p) => p.paymentId))
      return
    }
    for (const payment of payments) {
      if (seen.current.has(payment.paymentId)) continue
      seen.current.add(payment.paymentId)
      toast.success(`${payment.renewal ? "Renewal" : "New purchase"} · ${formatINR(payment.amountPaise, { paise: false })}`, {
        description: `${payment.fullName}${payment.plan ? ` · ${payment.plan}` : ""}`,
        duration: 8000,
      })
    }
  }, [payments])

  return null
}
