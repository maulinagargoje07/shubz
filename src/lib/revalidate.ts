import { revalidatePath } from "next/cache"

/**
 * Invalidate every cached page after a mutation.
 *
 * Granular `revalidatePath("/indicator/subscribers")` calls are the wrong tool:
 * most figures here surface in several places at once. Ticking TradingView
 * access changes the subscriber list, the overview's "Give access" count and
 * its waiting list. Remembering to name every page at every call site is a
 * rule nobody keeps, and the failure is silent — the page just quietly shows
 * the old number.
 *
 * `revalidatePath("/", "layout")` invalidates the whole tree below the root
 * layout. The cost is that an unrelated page re-renders on its next visit,
 * which for a single-admin internal tool where every page is already
 * `force-dynamic` is close to free. Correctness is worth far more here than
 * saving a query.
 */
export function revalidateEverything(): void {
  revalidatePath("/", "layout")
}
