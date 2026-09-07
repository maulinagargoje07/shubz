import Link from "next/link"
import { GraduationCap } from "lucide-react"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/status"
import { DataTable } from "@/components/data-table/table"
import { FilterBar, Pagination } from "@/components/data-table/filters"
import { PageHeader } from "@/components/page-header"
import { SOURCE_LABELS, toOptions } from "@/lib/labels"
import { contactListParamsSchema } from "@/lib/validation/contact"
import { listContacts } from "@/server/contacts/queries"
import { listBatchOptions } from "@/server/batches/options"
import { contactColumns } from "../contacts/contact-columns"

export const dynamic = "force-dynamic"
export const metadata = { title: "Students" }

/**
 * Students are not a separate table — they are contacts at the STUDENT
 * lifecycle stage. This page is that filtered view, which is why a lead who
 * pays keeps their entire history when they become a student.
 */
export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const raw = await searchParams
  const str = (v: string | string[] | undefined) =>
    typeof v === "string" && v !== "" ? v : undefined

  const params = contactListParamsSchema.parse({
    q: str(raw.q),
    stage: "STUDENT",
    source: str(raw.source),
    batch: str(raw.batch),
    page: str(raw.page) ?? 1,
    perPage: 25,
    sort: "fullName",
    dir: "asc",
  })

  const [{ rows, total }, batchOptions] = await Promise.all([
    listContacts(params),
    listBatchOptions(),
  ])
  const active = {
    q: params.q || undefined,
    source: params.source,
    batch: params.batch,
  }

  return (
    <div>
      <PageHeader
        title="Students"
        description="Contacts at the student stage — the same table, filtered."
        actions={
          <Button variant="outline" render={<Link href="/contacts" />}>
            All contacts
          </Button>
        }
      />

      <div className="pt-4">
        <FilterBar
          action="/students"
          params={active}
          searchPlaceholder="Search students"
          filters={[
            { key: "source", label: "Sources", options: toOptions(SOURCE_LABELS) },
            {
              key: "batch",
              label: "Batches",
              groupBy: (option) =>
                batchOptions.find((b) => b.value === option.value)?.group,
              options: batchOptions.map((b) => ({ value: b.value, label: b.label })),
            },
          ]}
        />
      </div>

      {total === 0 && !params.q && !params.source && !params.batch ? (
        <div className="px-4 sm:px-6">
          <EmptyState
            icon={<GraduationCap className="size-5" />}
            title="No students yet"
            description="A contact becomes a student when you set their stage, or when you enroll them."
            action={
              <Button render={<Link href="/enrollments/new" />}>Create an enrollment</Button>
            }
          />
        </div>
      ) : (
        <>
          <DataTable
            columns={contactColumns}
            rows={rows}
            rowKey={(row) => row.id}
            rowHref={(row) => `/contacts/${row.id}`}
            empty="No students match these filters."
          />
          <Pagination
            action="/students"
            params={active}
            page={params.page}
            perPage={params.perPage}
            total={total}
          />
        </>
      )}
    </div>
  )
}
