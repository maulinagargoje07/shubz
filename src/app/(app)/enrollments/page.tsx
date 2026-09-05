import Link from "next/link"
import { Plus, Receipt } from "lucide-react"

import { Button } from "@/components/ui/button"
import { EmptyState, StatusPill, enrollmentTone } from "@/components/ui/status"
import { DataTable, type Column } from "@/components/data-table/table"
import { FilterBar, Pagination } from "@/components/data-table/filters"
import { PageHeader } from "@/components/page-header"
import { formatDate } from "@/lib/fy"
import { formatINR } from "@/lib/money"
import { ENROLLMENT_STATUS_LABELS, toOptions } from "@/lib/labels"
import { programKindLabelOf } from "@/lib/programs"
import { listEnrollments } from "@/server/enrollments/queries"
import { listPrograms } from "@/server/programs/queries"
import type { DeliveryMode, ProgramType } from "@/db/schema"

export const dynamic = "force-dynamic"
export const metadata = { title: "Enrollments" }

type Row = {
  id: string
  status: keyof typeof ENROLLMENT_STATUS_LABELS
  contactName: string
  programName: string
  programType: ProgramType
  deliveryMode: DeliveryMode
  batchName: string | null
  seatNumber: string | null
  netPayablePaise: number
  totalPaidPaise: number
  balanceDuePaise: number
  isOverdue: boolean
  daysOverdue: number
  nextDueDate: string | null
}

const columns: Column<Row>[] = [
  {
    id: "student",
    header: "Student",
    priority: "primary",
    cell: (row) => row.contactName,
  },
  {
    id: "program",
    header: "Program",
    priority: "secondary",
    cell: (row) => (
      <div className="min-w-0">
        <p className="truncate">{row.programName}</p>
        <p className="truncate text-xs text-muted-foreground">
          {programKindLabelOf(row.programType, row.deliveryMode)}
          {row.batchName ? ` · ${row.batchName}` : ""}
          {row.seatNumber ? ` · Seat ${row.seatNumber}` : ""}
        </p>
      </div>
    ),
  },
  {
    id: "balance",
    header: "Balance",
    priority: "primary",
    align: "right",
    cell: (row) => (
      <span
        className={
          row.balanceDuePaise > 0
            ? "font-medium tabular-nums"
            : "tabular-nums text-muted-foreground"
        }
      >
        {formatINR(row.balanceDuePaise)}
      </span>
    ),
  },
  {
    id: "paid",
    header: "Paid",
    priority: "tertiary",
    align: "right",
    cell: (row) => (
      <span className="tabular-nums text-muted-foreground">
        {formatINR(row.totalPaidPaise)} of {formatINR(row.netPayablePaise)}
      </span>
    ),
  },
  {
    id: "due",
    header: "Next due",
    priority: "secondary",
    hideLabelOnCard: true,
    cell: (row) =>
      row.isOverdue ? (
        <StatusPill tone="overdue">{row.daysOverdue}d overdue</StatusPill>
      ) : row.nextDueDate ? (
        <span className="text-muted-foreground">{formatDate(row.nextDueDate)}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: "status",
    header: "Status",
    priority: "tertiary",
    cell: (row) => (
      <StatusPill tone={enrollmentTone(row.status)}>
        {ENROLLMENT_STATUS_LABELS[row.status]}
      </StatusPill>
    ),
  },
]

export default async function EnrollmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const raw = await searchParams
  const str = (v: string | string[] | undefined) =>
    typeof v === "string" && v !== "" ? v : undefined

  const page = Number(str(raw.page) ?? 1) || 1
  const perPage = 25
  const active = {
    status: str(raw.status),
    program: str(raw.program),
    overdue: str(raw.overdue),
  }

  const [{ rows, total }, programs] = await Promise.all([
    listEnrollments({
      page,
      perPage,
      programId: active.program,
      status: active.status,
      overdueOnly: active.overdue === "1",
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

      <div className="pt-4">
        <FilterBar
          action="/enrollments"
          params={active}
          showSearch={false}
          filters={[
            { key: "status", label: "Statuses", options: toOptions(ENROLLMENT_STATUS_LABELS) },
            {
              key: "program",
              label: "Programs",
              options: programs.map((p) => ({ value: p.id, label: p.name })),
            },
            { key: "overdue", label: "Any", options: [{ value: "1", label: "Overdue only" }] },
          ]}
        />
      </div>

      {total === 0 && !active.status && !active.program && !active.overdue ? (
        <div className="px-4 sm:px-6">
          <EmptyState
            icon={<Receipt className="size-5" />}
            title="No enrollments yet"
            description="Enroll a contact in a program to start tracking fees and attendance."
            action={<Button render={<Link href="/enrollments/new" />}>New enrollment</Button>}
          />
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={rows as unknown as Row[]}
            rowKey={(row) => row.id}
            rowHref={(row) => `/enrollments/${row.id}`}
            empty="No enrollments match these filters."
          />
          <Pagination
            action="/enrollments"
            params={active}
            page={page}
            perPage={perPage}
            total={total}
          />
        </>
      )}
    </div>
  )
}
