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
import { ArrowUpRight, Minus, TrendingDown, TrendingUp } from "lucide-react"
import { cn } from "cn"

import { LinkPending } from "@/components/layout/link-pending"
import { Sparkline } from "@/components/charts/sparkline"
import { AnimatedNumber, GlassPane } from "@/components/ui/glass"

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

/** How a figure moved against an earlier period: up a quarter on October, say. */
export type Delta = {
  /** The change as a fraction (0.25 = up 25%); null when there was nothing before. */
  ratio: number | null
  /** The period compared with: "October", "the previous 30 days". */
  vs: string
  /** Whether a rise is good news (money, buyers) or bad (failures). */
  upIsGood?: boolean
}

function DeltaChip({ delta }: { delta: Delta }) {
  if (delta.ratio === null) {
    return <span className="text-xs text-muted-foreground">Nothing in {delta.vs} to compare</span>
  }
  const pct = Math.round(Math.abs(delta.ratio) * 100)
  const flat = pct === 0
  const good = (delta.upIsGood ?? true) === (delta.ratio > 0)
  const Icon = flat ? Minus : delta.ratio > 0 ? TrendingUp : TrendingDown
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-semibold tabular-nums",
          flat
            ? "bg-secondary text-foreground"
            : good
              ? "bg-paid-muted text-paid-foreground"
              : "bg-overdue-muted text-overdue-foreground"
        )}
      >
        <Icon className="size-3" aria-hidden />
        {flat ? "No change" : `${pct}%`}
      </span>
      vs {delta.vs}
    </span>
  )
}

/**
 * A headline figure. Optionally a link, because on the dashboard every tile
 * is really a doorway to the list behind it. A `trend` draws the last few
 * weeks under the figure; a `delta` says how it moved against an earlier
 * period; `compact` is the small version for a row of five.
 */
export function StatTile({
  label,
  value,
  hint,
  tone,
  icon,
  href,
  delta,
  trend,
  trendColor,
  compact = false,
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  tone?: "overdue" | "paid"
  icon?: React.ReactNode
  href?: string
  delta?: Delta
  trend?: number[]
  trendColor?: string
  compact?: boolean
}) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {icon ? (
            <span
              className={cn(
                "flex shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]",
                compact ? "size-6" : "size-8",
                tone === "overdue" ? "text-overdue-foreground" : tone === "paid" ? "text-paid-foreground" : "text-primary"
              )}
            >
              {icon}
            </span>
          ) : null}
          <p className={cn("font-semibold uppercase tracking-wider text-muted-foreground", compact ? "text-[0.625rem]" : "text-[0.6875rem]")}>
            {label}
          </p>
        </div>
        {href ? (
          <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground/50 transition-colors group-hover:text-primary">
            <LinkPending />
            <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          "font-bold tracking-tight",
          compact ? "mt-2 text-2xl" : "mt-3 text-3xl sm:text-[2.125rem] sm:leading-none",
          tone === "overdue" && "text-overdue-foreground drop-shadow-[0_0_16px_rgba(239,68,68,0.45)]",
          tone === "paid" && "text-paid-foreground drop-shadow-[0_0_16px_rgba(16,185,129,0.45)]",
          !tone && "text-foreground"
        )}
      >
        {typeof value === "string" || typeof value === "number" ? <AnimatedNumber value={String(value)} /> : value}
      </p>
      {delta ? (
        <div className="mt-2">
          <DeltaChip delta={delta} />
        </div>
      ) : null}
      {hint ? <p className={cn("text-xs text-muted-foreground", delta ? "mt-1" : "mt-1.5")}>{hint}</p> : null}
      {trend && trend.length > 1 ? <Sparkline values={trend} color={trendColor} className="mt-3" height={44} /> : null}
    </>
  )

  const baseClass = cn(
    "block",
    compact ? "rounded-2xl p-3.5" : "rounded-3xl p-5",
    tone === "overdue" && "glass-overdue",
    tone === "paid" && "glass-paid",
    href && "group cursor-pointer active:scale-[0.985]"
  )

  if (href) {
    return (
      <GlassPane as="div" className={cn(baseClass, "p-0")}>
        <Link
          href={href}
          className={cn("block rounded-[inherit] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60", compact ? "p-3.5" : "p-5")}
        >
          {content}
        </Link>
      </GlassPane>
    )
  }

  return <GlassPane as="div" className={baseClass}>{content}</GlassPane>
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
    <div className="glass-tint rounded-3xl border-dashed px-6 py-12 text-center">
      {icon ? (
        <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
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
