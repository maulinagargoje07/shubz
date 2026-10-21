/**
 * Table cells shared by the Indicator lists, so a buyer reads the same way on
 * every page.
 */

import { MessageCircle } from "lucide-react"

import { CopyButton } from "@/components/indicator/copy-button"
import { expiryTone, StatusPill, subscriptionTone } from "@/components/ui/status"
import { formatDate, formatIST } from "@/lib/fy"
import {
  daysLeftLabel,
  expiryStatusHint,
  expiryStatusLabel,
  subscriptionStatusHint,
  subscriptionStatusLabel,
} from "@/lib/indicator"
import { formatPhone, whatsappHref } from "@/lib/phone-format"

export function BuyerCell({ name, email, tradingviewId }: { name: string; email: string; tradingviewId?: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-medium text-foreground">{name}</p>
      <p className="truncate text-xs text-muted-foreground">{email}</p>
      {tradingviewId ? (
        <p className="mt-0.5 flex min-w-0 items-center gap-0.5 text-xs">
          <span className="truncate font-mono text-foreground/90">{tradingviewId}</span>
          <CopyButton value={tradingviewId} label={`Copy TradingView username ${tradingviewId}`} />
        </p>
      ) : null}
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

/** The sheet's access status, in its colour. */
export function AccessStatus({ status }: { status: string | null | undefined }) {
  return (
    <span title={expiryStatusHint(status)}>
      <StatusPill tone={expiryTone(status)}>{expiryStatusLabel(status)}</StatusPill>
    </span>
  )
}

/** The date access runs out, with how far away that is. */
export function ValidTill({ date, daysLeft }: { date: string | null | undefined; daysLeft: number | null | undefined }) {
  if (!date) return <span className="text-muted-foreground">—</span>
  const relative = daysLeftLabel(daysLeft)
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
      <span className="whitespace-nowrap tabular-nums">{formatDate(date)}</span>
      {relative ? <span className="text-xs text-muted-foreground">{relative}</span> : null}
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
