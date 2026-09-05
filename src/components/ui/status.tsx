/**
 * Status pills and money tiles — SERVER components.
 *
 * Financial state is the thing an admin scans this app for, so it gets one
 * consistent visual language everywhere it appears: the same emerald for
 * settled, the same rose for overdue, on the fees dashboard, the enrollment
 * page, the contact profile and the schedule rows. Defining it once here is
 * what stops those drifting apart.
 */

import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { cn } from "cn"

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

/** Maps a payment-schedule status onto its tone, so the mapping lives once. */
export function scheduleTone(status: string): StatusTone {
  switch (status) {
    case "PAID":
      return "paid"
    case "OVERDUE":
      return "overdue"
    case "PARTIAL":
      return "pending"
    case "WAIVED":
      return "muted"
    default:
      return "neutral"
  }
}

export function enrollmentTone(status: string): StatusTone {
  switch (status) {
    case "ACTIVE":
      return "paid"
    case "PAUSED":
      return "pending"
    case "DROPPED":
    case "CANCELLED":
      return "overdue"
    default:
      return "neutral"
  }
}

export function lifecycleTone(stage: string): StatusTone {
  switch (stage) {
    case "STUDENT":
      return "paid"
    case "REGISTERED":
      return "info"
    case "ALUMNI":
      return "neutral"
    case "CHURNED":
      return "overdue"
    default:
      return "muted"
  }
}

export function attendanceTone(status: string): StatusTone {
  switch (status) {
    case "PRESENT":
      return "paid"
    case "LATE":
      return "pending"
    case "ABSENT":
      return "overdue"
    default:
      return "muted"
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
          <span className="text-muted-foreground/40 transition-colors group-hover:text-primary">
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
