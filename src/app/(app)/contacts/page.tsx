import Link from "next/link"
import { Plus, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/status"
import { DataTable } from "@/components/data-table/table"
import { FilterBar, Pagination } from "@/components/data-table/filters"
import { PageHeader } from "@/components/page-header"
import { LIFECYCLE_LABELS, SOURCE_LABELS, toOptions } from "@/lib/labels"
import { enumParam, idParam, pageParam, textParam } from "@/lib/search-params"
import { contactListParamsSchema } from "@/lib/validation/contact"
import { listAllTags, listContacts } from "@/server/contacts/queries"
import { listBatchOptions } from "@/server/batches/options"
import { contactColumns } from "./contact-columns"

export const dynamic = "force-dynamic"
export const metadata = { title: "Contacts" }

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const raw = await searchParams
  // A stale bookmark should still load the list, so unparseable params fall
  // back to defaults rather than throwing. The id filters go through idParam
  // because the schema checks they are strings, not that they are uuids, and
  // a non-uuid reaches Postgres as one and takes the page down.
  const params = contactListParamsSchema.parse({
    q: textParam(raw.q),
    stage: enumParam(raw.stage, Object.keys(LIFECYCLE_LABELS)),
    source: enumParam(raw.source, Object.keys(SOURCE_LABELS)),
    tag: idParam(raw.tag),
    batch: idParam(raw.batch, ["none"]),
    page: pageParam(raw.page),
    perPage: 25,
    sort: "createdAt",
    dir: "desc",
  })

  const [{ rows, total }, tags, batchOptions] = await Promise.all([
    listContacts(params),
    listAllTags(),
    listBatchOptions(),
  ])

  const active = {
    q: params.q || undefined,
    stage: params.stage,
    source: params.source,
    tag: params.tag,
    batch: params.batch,
  }

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

      <div className="pt-4">
        <FilterBar
          action="/contacts"
          params={active}
          searchPlaceholder="Search name, phone or email"
          filters={[
            { key: "stage", label: "Stages", options: toOptions(LIFECYCLE_LABELS) },
            { key: "source", label: "Sources", options: toOptions(SOURCE_LABELS) },
            {
              key: "batch",
              label: "Batches",
              groupBy: (option) =>
                batchOptions.find((b) => b.value === option.value)?.group,
              options: batchOptions.map((b) => ({ value: b.value, label: b.label })),
            },
            ...(tags.length
              ? [
                  {
                    key: "tag",
                    label: "Tags",
                    options: tags.map((t) => ({ value: t.id, label: t.name })),
                  },
                ]
              : []),
          ]}
        />
      </div>

      {rows.length === 0 && !params.q && !params.stage && !params.source && !params.batch ? (
        <div className="px-4 sm:px-6">
          <EmptyState
            icon={<Users className="size-5" />}
            title="No contacts yet"
            description="Add someone by hand, or import a CSV export from your spreadsheet."
            action={
              <div className="flex gap-2">
                <Button render={<Link href="/contacts/new" />}>Add contact</Button>
                <Button variant="outline" render={<Link href="/imports" />}>
                  Import CSV
                </Button>
              </div>
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
            empty="No contacts match these filters."
          />
          <Pagination
            action="/contacts"
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
