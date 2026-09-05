import Link from "next/link"

import { Button } from "@/components/ui/button"
import { DataTablePagination } from "@/components/data-table/pagination"
import { FilterBar } from "@/components/data-table/filter-bar"
import { PageHeader } from "@/components/page-header"
import { SOURCE_LABELS, toOptions } from "@/lib/labels"
import { contactListParamsSchema } from "@/lib/validation/contact"
import { listContacts } from "@/server/contacts/queries"
import { ContactsTable } from "../contacts/contacts-table"

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
  const params = contactListParamsSchema.parse({
    q: raw.q,
    stage: "STUDENT",
    source: raw.source,
    page: raw.page ?? 1,
    perPage: 25,
    sort: "fullName",
    dir: "asc",
  })

  const { rows, total } = await listContacts(params)

  return (
    <div>
      <PageHeader
        title="Students"
        description="Contacts at the student stage. Same table, filtered view."
        actions={
          <Button variant="outline" render={<Link href="/contacts" />}>
            All contacts
          </Button>
        }
      />

      <FilterBar
        searchPlaceholder="Search students…"
        filters={[{ key: "source", label: "Source", options: toOptions(SOURCE_LABELS) }]}
      />

      <ContactsTable rows={rows} />
      <DataTablePagination page={params.page} perPage={params.perPage} total={total} />
    </div>
  )
}
