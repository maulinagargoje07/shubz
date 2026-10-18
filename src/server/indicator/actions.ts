"use server"

/**
 * The one change this app makes to indicator data: the "TradingView access
 * given" tick on a subscriber.
 *
 * Shape as everywhere else — zod parse, authorise, change, audit, revalidate —
 * with one difference forced by where the data lives. The subscriber belongs to
 * the payments service, so the change is made there first and the audit row is
 * written here once that service has confirmed it. A failed audit write is
 * logged rather than reported as a failed tick, because the tick did happen.
 */

import { mutate } from "@/lib/audit"
import { revalidateEverything } from "@/lib/revalidate"
import { checkPermission } from "@/lib/session"
import { setTradingViewAccessSchema } from "@/lib/validation/indicator"
import type { ActionResult } from "@/lib/validation/shared"
import { PaymentsApiError, setTradingViewAccess } from "./api"

export async function updateTradingViewAccess(input: unknown): Promise<
  ActionResult<{
    granted: boolean
    changed: boolean
    updatedAt: string | null
    updatedBy: string | null
  }>
> {
  const gate = await checkPermission("MANAGE_TRADINGVIEW_ACCESS")
  if (!gate.ok) return gate
  const actor = gate.user

  const parsed = setTradingViewAccessSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Unknown request." }
  const { subscriptionId, granted } = parsed.data

  let result: Awaited<ReturnType<typeof setTradingViewAccess>>
  try {
    result = await setTradingViewAccess(subscriptionId, granted, actor.name)
  } catch (error) {
    if (error instanceof PaymentsApiError) {
      return {
        ok: false,
        error:
          error.kind === "not_found" ? "That subscriber no longer exists." : error.message,
      }
    }
    throw error
  }

  // A repeat (a double click, or another admin got there first) changed
  // nothing, so there is nothing to audit.
  if (result.changed) {
    try {
      await mutate(actor, async ({ audit }) => {
        await audit({
          action: granted ? "TRADINGVIEW_ACCESS_GRANTED" : "TRADINGVIEW_ACCESS_REMOVED",
          entity: "subscriber",
          entityId: subscriptionId,
          before: result.before,
          after: {
            granted,
            tradingviewId: result.subscriber?.tradingviewId ?? null,
            updatedAt: result.subscriber?.access.updatedAt ?? null,
          },
        })
      })
    } catch (error) {
      console.error("Audit write failed after a TradingView access change:", error)
    }
  }

  revalidateEverything()
  return {
    ok: true,
    data: {
      granted,
      changed: result.changed,
      updatedAt: result.subscriber?.access.updatedAt ?? null,
      updatedBy: result.subscriber?.access.updatedBy ?? null,
    },
  }
}
