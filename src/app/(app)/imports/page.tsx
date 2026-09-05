import { PageHeader } from "@/components/page-header"
import { formatIST } from "@/lib/fy"
import { db } from "@/db"
import { imports } from "@/db/schema"
import { desc } from "drizzle-orm"
import { ImportWizard } from "./import-wizard"

export const dynamic = "force-dynamic"
export const metadata = { title: "Import contacts" }

export default async function ImportsPage() {
  const recent = await db
    .select()
    .from(imports)
    .orderBy(desc(imports.createdAt))
    .limit(10)

  return (
    <div>
      <PageHeader
        title="Import contacts"
        description="Upload a CSV, map the columns, review the counts, then commit."
      />

      <ImportWizard />

      {recent.length > 0 ? (
        <section className="px-6 pb-10">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Recent imports
          </h2>
          <div className="divide-y rounded-lg border text-sm">
            {recent.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1 truncate font-medium">{row.filename}</span>
                <span className="text-xs text-muted-foreground">
                  {formatIST(row.createdAt)}
                </span>
                <span className="text-xs tabular-nums">
                  <span className="text-emerald-700 dark:text-emerald-400">
                    {row.validCount} valid
                  </span>
                  {" · "}
                  {row.dupCount} duplicate
                  {" · "}
                  <span className={row.invalidCount > 0 ? "text-rose-700 dark:text-rose-400" : ""}>
                    {row.invalidCount} invalid
                  </span>
                </span>
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  {row.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
