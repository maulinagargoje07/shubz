"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { DataTable, type DataTableColumns } from "@/components/data-table/data-table"
import { formatDate } from "@/lib/fy"
import { formatPhone } from "@/lib/phone"
import { LIFECYCLE_LABELS, LIFECYCLE_TONES, SOURCE_LABELS } from "@/lib/labels"
import type { ContactListRow } from "@/server/contacts/queries"

export function ContactsTable({ rows }: { rows: ContactListRow[] }) {
  const router = useRouter()

  const columns: DataTableColumns<ContactListRow> = [
    {
      accessorKey: "fullName",
      header: "Name",
      cell: ({ row }) => (
        <Link
          href={`/contacts/${row.original.id}`}
          className="font-medium hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {row.original.fullName}
        </Link>
      ),
    },
    {
      accessorKey: "phoneE164",
      header: "Phone",
      cell: ({ row }) => (
        <span className="tabular-nums">{formatPhone(row.original.phoneE164)}</span>
      ),
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => row.original.email ?? <span className="text-muted-foreground">—</span>,
    },
    {
      accessorKey: "city",
      header: "City",
      cell: ({ row }) => row.original.city ?? <span className="text-muted-foreground">—</span>,
    },
    {
      accessorKey: "lifecycleStage",
      header: "Stage",
      cell: ({ row }) => (
        <Badge variant="secondary" className={LIFECYCLE_TONES[row.original.lifecycleStage]}>
          {LIFECYCLE_LABELS[row.original.lifecycleStage]}
        </Badge>
      ),
    },
    {
      accessorKey: "source",
      header: "Source",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{SOURCE_LABELS[row.original.source]}</span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Added",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatDate(row.original.createdAt)}</span>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={rows}
      emptyMessage="No contacts match these filters."
      onRowClick={(row) => router.push(`/contacts/${row.id}`)}
    />
  )
}
