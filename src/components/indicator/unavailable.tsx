/**
 * What an Indicator page shows when the payments service can't be read:
 * what went wrong, and for a setup problem, exactly what to set where.
 */

import { CloudOff, KeyRound } from "lucide-react"

import { AutoRefresh } from "@/components/indicator/auto-refresh"
import { formatIST } from "@/lib/fy"
import type { PaymentsApiError } from "@/server/indicator/api"

const SETUP_PROBLEMS = new Set(["not_configured", "unauthorized", "disabled"])

export function IndicatorUnavailable({ error }: { error: PaymentsApiError }) {
  const setup = SETUP_PROBLEMS.has(error.kind)
  const Icon = setup ? KeyRound : CloudOff

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="max-w-2xl rounded-xl border border-overdue/35 bg-overdue-muted/30 p-5">
        <div className="flex items-start gap-3">
          <Icon className="mt-0.5 size-5 shrink-0 text-overdue-foreground" aria-hidden />
          <div className="min-w-0 space-y-3 text-sm">
            <div>
              <h2 className="font-semibold text-foreground">
                {setup ? "The CRM isn't connected to the payments service yet" : "Couldn't load indicator data"}
              </h2>
              <p className="mt-1 text-muted-foreground">{error.message}</p>
            </div>

            {setup ? (
              <ol className="list-decimal space-y-1.5 pl-5 text-muted-foreground">
                <li>
                  In Railway, open <strong className="text-foreground">shubztrader-payments</strong> → Variables
                  and make sure <code className="text-foreground">ADMIN_API_KEY</code> is set (at least 32
                  characters).
                </li>
                <li>
                  Open this CRM&apos;s service (<strong className="text-foreground">shubz</strong>) → Variables and
                  set <code className="text-foreground">PAYMENTS_ADMIN_KEY</code> to exactly the same value.
                </li>
                <li>Railway redeploys both. Reload this page once they show as active.</li>
              </ol>
            ) : (
              <AutoRefresh updatedLabel={`${formatIST(new Date(), "h:mm:ss a")} · retrying`} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
