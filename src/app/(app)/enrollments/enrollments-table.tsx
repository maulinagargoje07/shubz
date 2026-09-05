"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { DataTable, type DataTableColumns } from "@/components/data-table/data-table"
import { formatDate } from "@/lib/fy"
import { formatINR } from "@/lib/money"
import { ENROLLMENT_STATUS_LABELS } from "@/lib/labels"
import { programKindLabelOf } from "@/lib/programs"
import type { DeliveryMode, ProgramType } from "@/db/schema"

export type EnrollmentRow = {
  id: string
  status: keyof typeof ENROLLMENT_STATUS_LABELS
  enrolledOn: string
  contactId: string
  contactName: string
  programId: string
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

export function EnrollmentsTable({ rows }: { rows: EnrollmentRow[] }) {
  const router = useRouter()

  const columns: DataTableColumns<EnrollmentRow> = [
    {
      accessorKey: "contactName",
      header: "Student",
      cell: ({ row }) => (
        <Link
          href={`/enrollments/${row.original.id}`}
          className="font-medium hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {row.original.contactName}
        </Link>
      ),
    },
    {
      id: "program",
      header: "Program",
      cell: ({ row }) => (
        <div className="min-w-0">
          <p>{row.original.programName}</p>
          <p className="text-xs text-muted-foreground">
            {programKindLabelOf(row.original.programType, row.original.deliveryMode)}
            {row.original.batchName ? ` · ${row.original.batchName}` : ""}
            {row.original.seatNumber ? ` · Seat ${row.original.seatNumber}` : ""}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "netPayablePaise",
      header: "Payable",
      cell: ({ row }) => (
        <span className="tabular-nums">{formatINR(row.original.netPayablePaise)}</span>
      ),
    },
    {
      accessorKey: "totalPaidPaise",
      header: "Paid",
      cell: ({ row }) => (
        <span className="tabular-nums">{formatINR(row.original.totalPaidPaise)}</span>
      ),
    },
    {
      accessorKey: "balanceDuePaise",
      header: "Balance",
      cell: ({ row }) => (
        <span
          className={
            row.original.balanceDuePaise > 0
              ? "font-medium tabular-nums"
              : "tabular-nums text-muted-foreground"
          }
        >
          {formatINR(row.original.balanceDuePaise)}
        </span>
      ),
    },
    {
      accessorKey: "nextDueDate",
      header: "Next due",
      cell: ({ row }) =>
        row.original.isOverdue ? (
          <Badge variant="secondary" className="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200">
            {row.original.daysOverdue}d overdue
          </Badge>
        ) : row.original.nextDueDate ? (
          <span className="text-muted-foreground">{formatDate(row.original.nextDueDate)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant="secondary">{ENROLLMENT_STATUS_LABELS[row.original.status]}</Badge>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={rows}
      emptyMessage="No enrollments yet."
      onRowClick={(row) => router.push(`/enrollments/${row.id}`)}
    />
  )
}
