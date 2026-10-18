/**
 * Table cells shared by the Indicator lists, so a buyer reads the same way on
 * every page.
 */

import { MessageCircle } from "lucide-react"

import { CopyButton } from "@/components/indicator/copy-button"
import { StatusPill, subscriptionTone } from "@/components/ui/status"
import { formatIST } from "@/lib/fy"
import { subscriptionStatusHint, subscriptionStatusLabel } from "@/lib/indicator"
import { formatPhone, whatsappHref } from "@/lib/phone-format"

export function BuyerCell({ name, email }: { name: string; email: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-medium text-foreground">{name}</p>
      <p className="truncate text-xs text-muted-foreground">{email}</p>
    </div>
  )
}

/** The username as typed at checkout, ready to paste into TradingView. */
export function TradingViewCell({ id }: { id: string }) {
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-0.5">
      <span className="truncate font-mono text-[0.8125rem] text-foreground">{id}</span>
      <CopyButton value={id} label={`Copy TradingView username ${id}`} />
    </span>
  )
}

/** The number dials on a phone; the icon opens a WhatsApp chat. */
export function ContactCell({ phone }: { phone: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1">
      <a
        href={`tel:${phone}`}
        title="Call"
        className="whitespace-nowrap tabular-nums underline-offset-4 hover:text-primary hover:underline"
      >
        {formatPhone(phone)}
      </a>
      <a
        href={whatsappHref(phone)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`WhatsApp ${formatPhone(phone)}`}
        title="WhatsApp"
        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-paid pointer-coarse:size-11"
      >
        <MessageCircle className="size-3.5" aria-hidden />
      </a>
    </span>
  )
}

export function SubscriptionStatus({ status }: { status: string }) {
  return (
    <span title={subscriptionStatusHint(status)}>
      <StatusPill tone={subscriptionTone(status)}>{subscriptionStatusLabel(status)}</StatusPill>
    </span>
  )
}

export function When({ iso, pattern = "d MMM yyyy, h:mm a" }: { iso: string | null; pattern?: string }) {
  if (!iso) return <span className="text-muted-foreground">—</span>
  return (
    <time dateTime={iso} className="whitespace-nowrap text-muted-foreground">
      {formatIST(iso, pattern)}
    </time>
  )
}

/** A Razorpay ID, in the monospace it's searched by, with a copy button. */
export function RazorpayId({ id, label }: { id: string | null; label: string }) {
  if (!id) return <span className="text-muted-foreground">—</span>
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-0.5">
      <span className="truncate font-mono text-xs text-muted-foreground">{id}</span>
      <CopyButton value={id} label={`Copy ${label}`} />
    </span>
  )
}
