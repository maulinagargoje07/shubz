/**
 * Status pills and money tiles — SERVER components.
 *
 * Payment state is the thing an admin scans this app for, so it gets one
 * consistent visual language everywhere it appears: the same emerald for
 * paying, the same amber for "needs a look", the same rose for "act on this",
 * on the overview, the subscriber list and the payment lists. Defining it once
 * here is what stops those drifting apart.
 */

import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { cn } from "cn"

import { LinkPending } from "@/components/layout/link-pending"

export type StatusTone =
  | "neutral"
  | "paid"
  | "pending"
  | "overdue"
  | "info"
  | "muted"

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "border border-border/80 bg-secondary text-secondary-foreground",
  paid: "border border-paid/30 bg-paid-muted text-paid-foreground",
  pending: "border border-pending/30 bg-pending-muted text-pending-foreground",
  overdue: "border border-overdue/30 bg-overdue-muted text-overdue-foreground font-semibold",
  info: "border border-primary/30 bg-primary/15 text-primary",
  muted: "border border-border/50 bg-muted text-muted-foreground",
}

export function StatusPill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: StatusTone
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap shadow-xs",
        TONE_CLASSES[tone],
        className
      )}
    >
      {children}
    </span>
  )
}

/**
 * Maps a Razorpay subscription status onto its tone, so the mapping lives once:
 * paying is green, a retrying renewal is amber, a halted one needs attention.
 */
export function subscriptionTone(status: string): StatusTone {
  switch (status) {
    case "authenticated":
    case "active":
      return "paid"
    case "pending":
      return "pending"
    case "halted":
      return "overdue"
    case "paused":
    case "cancelled":
    case "completed":
    case "expired":
      return "muted"
    default:
      return "neutral"
  }
}

/**
 * The sheet's colour key for access status: green active, amber expiring
 * soon, red expired, and gold for a row whose plan couldn't be read.
 */
export function expiryTone(status: string | null | undefined): StatusTone {
  switch (status) {
    case "active":
      return "paid"
    case "expiring":
      return "pending"
    case "expired":
      return "overdue"
    case "check":
      return "info"
    default:
      return "neutral"
  }
}

/**
 * A headline figure. Optionally a link, because on the dashboard every tile
 * is really a doorway to the list behind it.
 */
export function StatTile({
  label,
  value,
  hint,
  tone,
  icon,
  href,
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  tone?: "overdue" | "paid"
  icon?: React.ReactNode
  href?: string
}) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon ? <span className="text-muted-foreground">{icon}</span> : null}
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground/80">
            {label}
          </p>
        </div>
        {href ? (
          <span className="flex items-center gap-1.5 text-muted-foreground/40 transition-colors group-hover:text-primary">
            <LinkPending />
            <ArrowUpRight className="size-3.5" aria-hidden />
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          "mt-2 text-2xl font-bold tracking-tight tabular-nums sm:text-3xl",
          tone === "overdue" && "text-overdue",
          tone === "paid" && "text-paid",
          !tone && "text-foreground"
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground/80">{hint}</p> : null}
    </>
  )

  const baseClass = cn(
    "rounded-xl border p-4 shadow-xs transition-all",
    tone === "overdue"
      ? "border-overdue/40 bg-overdue-muted/15"
      : tone === "paid"
        ? "border-paid/40 bg-paid-muted/15"
        : "border-border/80 bg-card",
    href && "group hover:border-primary/50 hover:bg-secondary/40 active:scale-[0.985] cursor-pointer"
  )

  if (href) {
    return (
      <Link href={href} className={baseClass}>
        {content}
      </Link>
    )
  }

  return <div className={baseClass}>{content}</div>
}

/** An empty state that says what to do next rather than just what is missing. */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-dashed border-border/80 bg-card/40 px-6 py-12 text-center">
      {icon ? (
        <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full border border-border/60 bg-secondary/80 text-muted-foreground">
          {icon}
        </div>
      ) : null}
      <p className="font-semibold text-foreground">{title}</p>
      {description ? (
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  )
}
