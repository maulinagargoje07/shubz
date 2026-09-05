import Link from "next/link"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DataTablePagination } from "@/components/data-table/pagination"
import { FilterBar } from "@/components/data-table/filter-bar"
import { PageHeader } from "@/components/page-header"
import { LIFECYCLE_LABELS, SOURCE_LABELS, toOptions } from "@/lib/labels"
import { contactListParamsSchema } from "@/lib/validation/contact"
import { listAllTags, listContacts } from "@/server/contacts/queries"
import { ContactsTable } from "./contacts-table"

export const dynamic = "force-dynamic"
export const metadata = { title: "Contacts" }

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const raw = await searchParams
  // Unparseable params fall back to defaults rather than erroring — a stale
  // bookmark should still load the list.
  const params = contactListParamsSchema.parse({
    q: raw.q,
    stage: raw.stage,
    source: raw.source,
    tag: raw.tag,
    page: raw.page ?? 1,
    perPage: raw.perPage ?? 25,
    sort: raw.sort ?? "createdAt",
    dir: raw.dir ?? "desc",
  })

  const [{ rows, total }, tags] = await Promise.all([listContacts(params), listAllTags()])

  return (
    <div>
      <PageHeader
        title="Contacts"
        description="Leads, registrants and students all live here."
        actions={
          <Button render={<Link href="/contacts/new" />}>
            <Plus className="size-4" />
            Add contact
          </Button>
        }
      />

      <FilterBar
        searchPlaceholder="Search name, phone or email…"
        filters={[
          { key: "stage", label: "Stage", options: toOptions(LIFECYCLE_LABELS) },
          { key: "source", label: "Source", options: toOptions(SOURCE_LABELS) },
          ...(tags.length
            ? [
                {
                  key: "tag",
                  label: "Tag",
                  options: tags.map((t) => ({ value: t.id, label: t.name })),
                },
              ]
            : []),
        ]}
      />

      <ContactsTable rows={rows} />
      <DataTablePagination page={params.page} perPage={params.perPage} total={total} />
    </div>
  )
}
