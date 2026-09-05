/**
 * Status pills and money tiles — SERVER components.
 *
 * Financial state is the thing an admin scans this app for, so it gets one
 * consistent visual language everywhere it appears: the same emerald for
 * settled, the same rose for overdue, on the fees dashboard, the enrollment
 * page, the contact profile and the schedule rows. Defining it once here is
 * what stops those drifting apart.
 */

import { cn } from "cn"

export type StatusTone =
  | "neutral"
  | "paid"
  | "pending"
  | "overdue"
  | "info"
  | "muted"

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-secondary text-secondary-foreground",
  paid: "bg-paid-muted text-paid-foreground",
  pending: "bg-pending-muted text-pending-foreground",
  overdue: "bg-overdue-muted text-overdue-foreground",
  info: "bg-accent text-accent-foreground",
  muted: "bg-muted text-muted-foreground",
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
        "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap",
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
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  tone?: "overdue" | "paid"
  icon?: React.ReactNode
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
        <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      </div>
      <p
        className={cn(
          "mt-1.5 text-xl font-semibold tabular-nums sm:text-2xl",
          tone === "overdue" && "text-overdue",
          tone === "paid" && "text-paid"
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
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
    <div className="rounded-xl border border-dashed bg-card px-6 py-12 text-center">
      {icon ? (
        <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </div>
      ) : null}
      <p className="font-medium">{title}</p>
      {description ? (
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  )
}
