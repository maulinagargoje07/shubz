"use server"

/**
 * The meetup's one write: asking the payments service to read the Payment
 * Page's past payments from Razorpay, for registrations made before the
 * webhook events were switched on. Same shape as the other actions: zod
 * parse, authorise, change in the payments service, audit here once it has
 * answered, revalidate. Superadmins only: it reaches out to Razorpay, and
 * there is no finer permission that fits.
 */

import { mutate } from "@/lib/audit"
import type { MeetupBackfillResult } from "@/lib/indicator"
import { revalidateEverything } from "@/lib/revalidate"
import { getSessionUser } from "@/lib/session"
import { meetupBackfillSchema } from "@/lib/validation/meetup"
import type { ActionResult } from "@/lib/validation/shared"
import { backfillMeetup, PaymentsApiError } from "./api"

export async function backfillMeetupAction(input: unknown): Promise<ActionResult<MeetupBackfillResult>> {
  const user = await getSessionUser()
  if (!user) return { ok: false, error: "Your session has expired. Sign in again." }
  if (user.role !== "SUPERADMIN") return { ok: false, error: "Only a superadmin can ask Razorpay for past payments." }

  const parsed = meetupBackfillSchema.safeParse(input ?? {})
  if (!parsed.success) return { ok: false, error: "Check the dates." }

  let result: MeetupBackfillResult
  try {
    result = await backfillMeetup(parsed.data, user.name)
  } catch (error) {
    if (error instanceof PaymentsApiError) return { ok: false, error: error.message }
    throw error
  }

  try {
    await mutate(user, async ({ audit }) => {
      await audit({
        action: "MEETUP_BACKFILL",
        entity: "meetup",
        entityId: result.pageId,
        after: {
          mode: result.mode,
          from: result.from,
          to: result.to,
          scanned: result.scanned,
          matched: result.matched,
          inserted: result.inserted,
          updated: result.updated,
          unmatched: result.unmatchedTotal,
        },
      })
    })
  } catch (error) {
    console.error("Audit write failed after a meetup backfill:", error)
  }

  revalidateEverything()
  return { ok: true, data: result }
}
