import Link from "next/link"
import { BookOpen, Eye, Pencil, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { EmptyState, StatusPill } from "@/components/ui/status"
import { DataTable, type Column } from "@/components/data-table/table"
import { PageHeader } from "@/components/page-header"
import { formatINRShort } from "@/lib/money"
import { PROGRAM_STATUS_LABELS } from "@/lib/labels"
import { billingCycleLabel, programKindLabelOf } from "@/lib/programs"
import { listPrograms } from "@/server/programs/queries"
import type { BillingCycle, DeliveryMode, ProgramType } from "@/db/schema"

export const dynamic = "force-dynamic"
export const metadata = { title: "Programs" }

type Row = {
  id: string
  name: string
  code: string
  type: ProgramType
  deliveryMode: DeliveryMode
  defaultFeePaise: number
  defaultBillingType: "ONE_TIME" | "RECURRING"
  defaultBillingCycle: BillingCycle | null
  status: string
  batchCount: number
  activeEnrollments: number
}

const columns: Column<Row>[] = [
  {
    id: "name",
    header: "Program",
    priority: "primary",
    cell: (row) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{row.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {programKindLabelOf(row.type, row.deliveryMode)} · {row.code}
        </p>
      </div>
    ),
  },
  {
    id: "fee",
    header: "Default fee",
    priority: "primary",
    align: "right",
    cell: (row) => (
      <span className="tabular-nums">
        {formatINRShort(row.defaultFeePaise)}
        {row.defaultBillingType === "RECURRING" && row.defaultBillingCycle ? (
          <span className="text-muted-foreground">
            {" / "}
            {billingCycleLabel(row.defaultBillingCycle).toLowerCase()}
          </span>
        ) : null}
      </span>
    ),
  },
  {
    id: "students",
    header: "Active students",
    priority: "secondary",
    align: "right",
    cell: (row) => <span className="tabular-nums">{row.activeEnrollments}</span>,
  },
  {
    id: "batches",
    header: "Batches",
    priority: "tertiary",
    align: "right",
    cell: (row) => <span className="tabular-nums">{row.batchCount}</span>,
  },
  {
    id: "status",
    header: "Status",
    priority: "secondary",
    hideLabelOnCard: true,
    cell: (row) => (
      <StatusPill tone={row.status === "ACTIVE" ? "paid" : "neutral"}>
        {PROGRAM_STATUS_LABELS[row.status] ?? row.status}
      </StatusPill>
    ),
  },
  {
    id: "actions",
    header: "Actions",
    priority: "primary",
    align: "right",
    hideLabelOnCard: true,
    // No event handler on this wrapper: the cell is built in a Server
    // Component, and a function cannot cross the server/client boundary.
    // Passing one produced "Event handlers cannot be passed to Client
    // Component props" as a 500 in production. The DataTable renders the
    // actions column outside the row link, so there is no click to stop.
    cell: (row) => (
      <div className="flex items-center justify-end gap-1.5">
        <Link
          href={`/programs/${row.id}`}
          className="inline-flex size-8 items-center justify-center rounded-lg border border-border/80 bg-secondary/40 text-muted-foreground transition-all hover:border-primary/40 hover:bg-secondary hover:text-foreground active:scale-95"
          title="View program & batches"
          aria-label={`View ${row.name}`}
        >
          <Eye className="size-3.5" />
        </Link>
        <Link
          href={`/programs/${row.id}/edit`}
          className="inline-flex size-8 items-center justify-center rounded-lg border border-border/80 bg-secondary/40 text-muted-foreground transition-all hover:border-primary/40 hover:bg-secondary hover:text-foreground active:scale-95"
          title="Edit program"
          aria-label={`Edit ${row.name}`}
        >
          <Pencil className="size-3.5" />
        </Link>
        <Link
          href={`/programs/${row.id}/batches/new`}
          className="inline-flex size-8 items-center justify-center rounded-lg border border-border/80 bg-secondary/40 text-muted-foreground transition-all hover:border-primary/40 hover:bg-secondary hover:text-primary active:scale-95"
          title="New batch"
          aria-label={`New batch for ${row.name}`}
        >
          <Plus className="size-3.5" />
        </Link>
      </div>
    ),
  },
]

export default async function ProgramsPage() {
  const rows = await listPrograms()

  return (
    <div>
      <PageHeader
        title="Programs"
        description="Mentorship, Trading Floor, webinars and workshops."
        actions={
          <Button render={<Link href="/programs/new" />}>
            <Plus className="size-4" />
            New program
          </Button>
        }
      />

      <div className="pt-4">
        {rows.length === 0 ? (
          <div className="px-4 sm:px-6">
            <EmptyState
              icon={<BookOpen className="size-5" />}
              title="No programs yet"
              description="A program sets the default fee and billing, and decides whether its batches need a meeting link or a venue."
              action={<Button render={<Link href="/programs/new" />}>New program</Button>}
            />
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={rows as unknown as Row[]}
            rowKey={(row) => row.id}
            rowHref={(row) => `/programs/${row.id}`}
          />
        )}
      </div>
    </div>
  )
}
