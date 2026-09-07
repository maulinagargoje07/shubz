import Link from "next/link"
import { CalendarDays, MapPin, Plus, Video } from "lucide-react"

import { Button } from "@/components/ui/button"
import { EmptyState, StatusPill, type StatusTone } from "@/components/ui/status"
import { DataTable, type Column } from "@/components/data-table/table"
import { FilterBar } from "@/components/data-table/filters"
import { PageHeader } from "@/components/page-header"
import { formatDate, formatIST } from "@/lib/fy"
import { enumParam, idParam } from "@/lib/search-params"
import { BATCH_STATUS_LABELS } from "@/lib/labels"
import { programKindSuffixOf } from "@/lib/programs"
import { requirePermissionPage } from "@/lib/session"
import { BATCH_STATUSES } from "@/lib/validation/batch"
import { listAllBatches } from "@/server/batches/queries"
import { listPrograms } from "@/server/programs/queries"
import type { DeliveryMode, ProgramType } from "@/db/schema"

export const dynamic = "force-dynamic"
export const metadata = { title: "Batches" }

type Row = {
  id: string
  name: string
  code: string
  startDate: string | null
  endDate: string | null
  timingText: string | null
  capacity: number | null
  seatCapacity: number | null
  venueName: string | null
  status: string
  programId: string
  programName: string
  programType: ProgramType
  deliveryMode: DeliveryMode
  participantCount: number
  sessionCount: number
  heldCount: number
  markedCount: number
  nextSessionAt: string | null
}

function statusTone(status: string): StatusTone {
  switch (status) {
    case "RUNNING":
      return "paid"
    case "OPEN":
      return "info"
    case "PLANNED":
      return "pending"
    case "CANCELLED":
      return "overdue"
    default:
      return "neutral"
  }
}

const columns: Column<Row>[] = [
  {
    id: "name",
    header: "Batch",
    priority: "primary",
    cell: (row) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{row.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[
            row.programName,
            programKindSuffixOf(row.programName, row.programType, row.deliveryMode),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    ),
  },
  {
    id: "students",
    header: "Students",
    priority: "primary",
    align: "right",
    cell: (row) => (
      <span className="tabular-nums">
        {row.participantCount}
        {row.seatCapacity ? (
          <span className="text-muted-foreground">/{row.seatCapacity}</span>
        ) : row.capacity ? (
          <span className="text-muted-foreground">/{row.capacity}</span>
        ) : null}
      </span>
    ),
  },
  {
    id: "registers",
    header: "Registers",
    priority: "secondary",
    hideLabelOnCard: true,
    // The number that says whether this batch is being kept up with.
    cell: (row) =>
      row.heldCount === 0 ? (
        <span className="text-xs text-muted-foreground">
          {row.sessionCount === 0 ? "No sessions" : "None held yet"}
        </span>
      ) : row.markedCount >= row.heldCount ? (
        <StatusPill tone="paid">All {row.heldCount} marked</StatusPill>
      ) : (
        <StatusPill tone="pending">
          {row.heldCount - row.markedCount} of {row.heldCount} unmarked
        </StatusPill>
      ),
  },
  {
    id: "next",
    header: "Next session",
    priority: "secondary",
    cell: (row) =>
      row.nextSessionAt ? (
        <span className="text-muted-foreground">
          {formatIST(row.nextSessionAt, "d MMM, h:mm a")}
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: "runs",
    header: "Runs",
    priority: "tertiary",
    cell: (row) =>
      row.startDate ? (
        <span className="text-muted-foreground">
          {formatDate(row.startDate)}
          {row.endDate ? ` – ${formatDate(row.endDate)}` : ""}
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: "where",
    header: "Where",
    priority: "tertiary",
    cell: (row) => (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        {row.deliveryMode === "ONLINE" ? (
          <>
            <Video className="size-3.5 shrink-0" aria-hidden /> Online
          </>
        ) : (
          <>
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{row.venueName ?? "Offline"}</span>
          </>
        )}
      </span>
    ),
  },
  {
    id: "status",
    header: "Status",
    priority: "secondary",
    hideLabelOnCard: true,
    cell: (row) => (
      <StatusPill tone={statusTone(row.status)}>
        {BATCH_STATUS_LABELS[row.status] ?? row.status}
      </StatusPill>
    ),
  },
]

export default async function BatchesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requirePermissionPage("MANAGE_PROGRAMS")

  const raw = await searchParams
  const active = {
    program: idParam(raw.program),
    status: enumParam(raw.status, Object.keys(BATCH_STATUS_LABELS)),
  }

  const [rows, programs] = await Promise.all([
    listAllBatches({ programId: active.program, status: active.status }),
    listPrograms(),
  ])

  return (
    <div className="pb-8">
      <PageHeader
        title="Batches"
        description="Every batch across all programs — who is in it, and whether its registers are being kept."
        actions={
          <Button render={<Link href="/batches/new" />}>
            <Plus className="size-4" />
            New batch
          </Button>
        }
      />

      <div className="pt-4">
        <FilterBar
          action="/batches"
          params={active}
          showSearch={false}
          filters={[
            {
              key: "program",
              label: "Programs",
              options: programs.map((p) => ({ value: p.id, label: p.name })),
            },
            {
              key: "status",
              label: "Statuses",
              options: BATCH_STATUSES.map((s) => ({
                value: s,
                label: BATCH_STATUS_LABELS[s] ?? s,
              })),
            },
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <div className="px-4 sm:px-6">
          <EmptyState
            icon={<CalendarDays className="size-5" />}
            title={active.program || active.status ? "No batches match" : "No batches yet"}
            description="A batch groups students and the classes they attend. Create one, then schedule its sessions."
            action={<Button render={<Link href="/batches/new" />}>New batch</Button>}
          />
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={rows as unknown as Row[]}
          rowKey={(row) => row.id}
          rowHref={(row) => `/programs/${row.programId}/batches/${row.id}`}
        />
      )}
    </div>
  )
}
