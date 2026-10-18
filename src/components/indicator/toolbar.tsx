/**
 * The strip under each Indicator page header: which money you are looking at
 * (live or test), and that the page is keeping itself up to date.
 */

import Link from "next/link"
import { FlaskConical, Info } from "lucide-react"
import { cn } from "cn"

import { AutoRefresh } from "@/components/indicator/auto-refresh"
import { formatIST } from "@/lib/fy"
import { INDICATOR_MODES, MODE_LABELS, type IndicatorMode } from "@/lib/indicator"
import { hrefWith } from "@/server/indicator/filters"

export function IndicatorToolbar({
  path,
  params = {},
  mode,
  serviceMode,
  generatedAt,
}: {
  path: string
  /** Filters to keep when switching between live and test. */
  params?: Record<string, string | undefined>
  mode: IndicatorMode
  serviceMode: IndicatorMode
  generatedAt: string
}) {
  return (
    <div className="space-y-3 px-4 pt-4 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Live or test data" className="inline-flex rounded-lg border border-border bg-card p-0.5">
          {INDICATOR_MODES.map((option) => {
            const content = (
              <>
                {option === "test" ? <FlaskConical className="size-3.5" aria-hidden /> : null}
                {MODE_LABELS[option]}
              </>
            )
            const base = "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-colors"
            // The current mode is not a link: a link to the page you are on
            // only invites a pointless reload.
            if (option === mode) {
              return (
                <span key={option} aria-current="page" className={cn(base, "bg-primary text-primary-foreground")}>
                  {content}
                </span>
              )
            }
            return (
              <Link
                key={option}
                href={hrefWith(path, { ...params, mode: option === serviceMode ? undefined : option })}
                className={cn(base, "text-muted-foreground hover:text-foreground")}
              >
                {content}
              </Link>
            )
          })}
        </nav>
        <AutoRefresh updatedLabel={formatIST(generatedAt, "h:mm:ss a")} />
      </div>

      {mode === "test" ? (
        <p className="flex items-start gap-2.5 rounded-xl border border-pending/30 bg-pending-muted px-4 py-3 text-sm text-pending-foreground">
          <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Test mode: these are Razorpay test purchases, not real money.
            {serviceMode === "test"
              ? " Real buyers show up under Live once the checkout switches to live keys."
              : " Real buyers are under Live."}
          </span>
        </p>
      ) : serviceMode === "test" ? (
        <p className="flex items-start gap-2.5 rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <span>
            The checkout is still taking test payments, so nothing real is here yet. Your test purchases are
            under Test.
          </span>
        </p>
      ) : null}
    </div>
  )
}
