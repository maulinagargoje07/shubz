"use client"

import Link from "next/link"

import { DataTable, type DataTableColumns } from "@/components/data-table/data-table"
import { formatDate } from "@/lib/fy"
import { formatINR } from "@/lib/money"
import { PAYMENT_METHOD_LABELS } from "@/lib/labels"
import { programKindLabelOf } from "@/lib/programs"
import type { DeliveryMode, PaymentMethod, ProgramType } from "@/db/schema"

export type PaymentRow = {
  id: string
  amountPaise: number
  paidOn: string
  method: PaymentMethod
  referenceNo: string | null
  receiptNo: string
  contactId: string
  contactName: string
  programName: string
  programType: ProgramType
  deliveryMode: DeliveryMode
  batchName: string | null
}

export function PaymentsTable({ rows }: { rows: PaymentRow[] }) {
  const columns: DataTableColumns<PaymentRow> = [
    {
      accessorKey: "receiptNo",
      header: "Receipt",
      cell: ({ row }) => (
        <Link
          href={`/payments/${row.original.id}/receipt`}
          className="font-mono text-sm hover:underline"
        >
          {row.original.receiptNo}
        </Link>
      ),
    },
    {
      accessorKey: "paidOn",
      header: "Date",
      cell: ({ row }) => formatDate(row.original.paidOn),
    },
    {
      accessorKey: "contactName",
      header: "Student",
      cell: ({ row }) => (
        <Link href={`/contacts/${row.original.contactId}`} className="hover:underline">
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
          </p>
        </div>
      ),
    },
    {
      accessorKey: "method",
      header: "Method",
      cell: ({ row }) => (
        <div className="min-w-0">
          <p>{PAYMENT_METHOD_LABELS[row.original.method]}</p>
          {row.original.referenceNo ? (
            <p className="truncate text-xs text-muted-foreground">
              {row.original.referenceNo}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      accessorKey: "amountPaise",
      header: "Amount",
      cell: ({ row }) => (
        <span className="font-medium tabular-nums">{formatINR(row.original.amountPaise)}</span>
      ),
    },
  ]

  return <DataTable columns={columns} data={rows} emptyMessage="No payments in this range." />
}
