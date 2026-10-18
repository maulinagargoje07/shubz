"use client"

import { useEffect, useState } from "react"
import { Check, Copy } from "lucide-react"
import { toast } from "sonner"

/**
 * Copies a value — a TradingView username to paste into TradingView's
 * "Invite-only scripts" box, a payment ID for Razorpay's search.
 */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(timer)
  }, [copied])

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
    } catch {
      toast.error("Couldn't copy. Select the text and copy it instead.")
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : label}
      title={label}
      className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground pointer-coarse:size-11"
    >
      {copied ? <Check className="size-3.5 text-paid" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
    </button>
  )
}
