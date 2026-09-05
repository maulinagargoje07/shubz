"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { DataTable, type DataTableColumns } from "@/components/data-table/data-table"
import { formatINRShort } from "@/lib/money"
import { PROGRAM_STATUS_LABELS } from "@/lib/labels"
import { billingCycleLabel, programKindLabel } from "@/lib/programs"
import type { BillingCycle, DeliveryMode, ProgramType } from "@/db/schema"

export type ProgramRow = {
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

export function ProgramsTable({ rows }: { rows: ProgramRow[] }) {
  const router = useRouter()

  const columns: DataTableColumns<ProgramRow> = [
    {
      accessorKey: "name",
      header: "Program",
      cell: ({ row }) => (
        <div className="min-w-0">
          <Link
            href={`/programs/${row.original.id}`}
            className="font-medium hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {row.original.name}
          </Link>
          <p className="text-xs text-muted-foreground">{row.original.code}</p>
        </div>
      ),
    },
    {
      id: "kind",
      header: "Type",
      // The two columns are always rendered as one combined label.
      cell: ({ row }) => programKindLabel(row.original),
    },
    {
      accessorKey: "defaultFeePaise",
      header: "Default fee",
      cell: ({ row }) => (
        <span className="tabular-nums">
          {formatINRShort(row.original.defaultFeePaise)}
          {row.original.defaultBillingType === "RECURRING" && row.original.defaultBillingCycle ? (
            <span className="text-muted-foreground">
              {" "}
              / {billingCycleLabel(row.original.defaultBillingCycle).toLowerCase()}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      accessorKey: "batchCount",
      header: "Batches",
      cell: ({ row }) => <span className="tabular-nums">{row.original.batchCount}</span>,
    },
    {
      accessorKey: "activeEnrollments",
      header: "Active students",
      cell: ({ row }) => <span className="tabular-nums">{row.original.activeEnrollments}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant="secondary">
          {PROGRAM_STATUS_LABELS[row.original.status] ?? row.original.status}
        </Badge>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={rows}
      emptyMessage="No programs yet. Create one to get started."
      onRowClick={(row) => router.push(`/programs/${row.id}`)}
    />
  )
}
