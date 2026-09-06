import { revalidatePath } from "next/cache"

/**
 * Invalidate every cached page after a mutation.
 *
 * Granular `revalidatePath("/enrollments")` calls were the wrong tool here and
 * were the direct cause of deletions appearing not to take effect: almost
 * every figure in this app is an aggregate that surfaces in several places at
 * once. Deleting one enrollment changes the enrollments list, the fees
 * dashboard, the main dashboard tiles, the payments list, that student's
 * contact page, the students list and the CSV export. Remembering to name all
 * seven at every call site is a rule nobody keeps, and the failure is silent —
 * the page just quietly shows yesterday's number.
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
