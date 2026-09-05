import Link from "next/link"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DataTablePagination } from "@/components/data-table/pagination"
import { FilterBar } from "@/components/data-table/filter-bar"
import { PageHeader } from "@/components/page-header"
import { ENROLLMENT_STATUS_LABELS, toOptions } from "@/lib/labels"
import { listEnrollments } from "@/server/enrollments/queries"
import { listPrograms } from "@/server/programs/queries"
import { EnrollmentsTable, type EnrollmentRow } from "./enrollments-table"

export const dynamic = "force-dynamic"
export const metadata = { title: "Enrollments" }

export default async function EnrollmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const raw = await searchParams
  const page = Number(raw.page ?? 1) || 1
  const perPage = 25

  const [{ rows, total }, programs] = await Promise.all([
    listEnrollments({
      page,
      perPage,
      programId: typeof raw.program === "string" ? raw.program : undefined,
      status: typeof raw.status === "string" ? raw.status : undefined,
      overdueOnly: raw.overdue === "1",
    }),
    listPrograms(),
  ])

  return (
    <div>
      <PageHeader
        title="Enrollments"
        description="Balances are computed from the ledger, never stored."
        actions={
          <Button render={<Link href="/enrollments/new" />}>
            <Plus className="size-4" />
            New enrollment
          </Button>
        }
      />

      <FilterBar
        showSearch={false}
        filters={[
          { key: "status", label: "Status", options: toOptions(ENROLLMENT_STATUS_LABELS) },
          {
            key: "program",
            label: "Program",
            options: programs.map((p) => ({ value: p.id, label: p.name })),
          },
          { key: "overdue", label: "Overdue", options: [{ value: "1", label: "Overdue only" }] },
        ]}
      />

      <EnrollmentsTable rows={rows as unknown as EnrollmentRow[]} />
      <DataTablePagination page={page} perPage={perPage} total={total} />
    </div>
  )
}
