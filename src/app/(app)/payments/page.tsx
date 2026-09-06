import Link from "next/link"
import { IndianRupee, Receipt } from "lucide-react"

import { EmptyState } from "@/components/ui/status"
import { DataTable, type Column } from "@/components/data-table/table"
import { FilterBar, Pagination } from "@/components/data-table/filters"
import { PageHeader } from "@/components/page-header"
import { formatDate } from "@/lib/fy"
import { formatINR } from "@/lib/money"
import { PAYMENT_METHOD_LABELS, toOptions } from "@/lib/labels"
import { programKindLabelOf } from "@/lib/programs"
import { paymentListParamsSchema } from "@/lib/validation/payment"
import { listPayments } from "@/server/payments/queries"
import { listPrograms } from "@/server/programs/queries"
import type { DeliveryMode, PaymentMethod, ProgramType } from "@/db/schema"
import { VoidPaymentButton } from "../enrollments/[id]/record-actions"

export const dynamic = "force-dynamic"
export const metadata = { title: "Payments" }

type Row = {
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
}

const columns: Column<Row>[] = [
  {
    id: "student",
    header: "Student",
    priority: "primary",
    cell: (row) => row.contactName,
  },
  {
    id: "amount",
    header: "Amount",
    priority: "primary",
    align: "right",
    cell: (row) => (
      <span className="font-medium tabular-nums">{formatINR(row.amountPaise)}</span>
    ),
  },
  {
    id: "receipt",
    header: "Receipt",
    priority: "secondary",
    cell: (row) => (
      <Link
        href={`/payments/${row.id}/receipt`}
        className="font-mono text-xs hover:underline"
      >
        {row.receiptNo}
      </Link>
    ),
  },
  {
    id: "date",
    header: "Date",
    priority: "secondary",
    cell: (row) => <span className="text-muted-foreground">{formatDate(row.paidOn)}</span>,
  },
  {
    id: "program",
    header: "Program",
    priority: "tertiary",
    cell: (row) => (
      <div className="min-w-0">
        <p className="truncate">{row.programName}</p>
        <p className="truncate text-xs text-muted-foreground">
          {programKindLabelOf(row.programType, row.deliveryMode)}
        </p>
      </div>
    ),
  },
  {
    id: "method",
    header: "Method",
    priority: "tertiary",
    cell: (row) => (
      <div className="min-w-0">
        <p>{PAYMENT_METHOD_LABELS[row.method]}</p>
        {row.referenceNo ? (
          <p className="truncate text-xs text-muted-foreground">{row.referenceNo}</p>
        ) : null}
      </div>
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
          href={`/payments/${row.id}/receipt`}
          className="inline-flex size-8 items-center justify-center rounded-lg border border-border/80 bg-secondary/40 text-muted-foreground transition-all hover:border-primary/40 hover:bg-secondary hover:text-foreground active:scale-95"
          title="View receipt"
          aria-label={`View receipt for ${row.receiptNo}`}
        >
          <Receipt className="size-3.5" />
        </Link>
        <VoidPaymentButton
          paymentId={row.id}
          amountPaise={row.amountPaise}
          receiptNo={row.receiptNo}
        />
      </div>
    ),
  },
]

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const raw = await searchParams
  const str = (v: string | string[] | undefined) =>
    typeof v === "string" && v !== "" ? v : undefined

  const params = paymentListParamsSchema.parse({
    from: str(raw.from),
    to: str(raw.to),
    method: str(raw.method),
    programId: str(raw.program),
    page: str(raw.page) ?? 1,
    perPage: 25,
  })

  const [{ rows, total, sumPaise }, programs] = await Promise.all([
    listPayments(params),
    listPrograms(),
  ])

  const active = {
    from: params.from,
    to: params.to,
    method: params.method,
    program: params.programId,
  }

  return (
    <div>
      <PageHeader
        title="Payments"
        description={`${total} payment${total === 1 ? "" : "s"} · ${formatINR(sumPaise)} in this view`}
      />

      <div className="pt-4">
        <FilterBar
          action="/payments"
          params={active}
          showSearch={false}
          filters={[
            { key: "method", label: "Methods", options: toOptions(PAYMENT_METHOD_LABELS) },
            {
              key: "program",
              label: "Programs",
              options: programs.map((p) => ({ value: p.id, label: p.name })),
            },
          ]}
        >
          {/* Native date inputs: the OS picker beats anything we would ship JS for. */}
          <label className="flex flex-col gap-1">
            <span className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
              From
            </span>
            <input
              type="date"
              name="from"
              defaultValue={params.from ?? ""}
              className="h-10 rounded-lg border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
              To
            </span>
            <input
              type="date"
              name="to"
              defaultValue={params.to ?? ""}
              className="h-10 rounded-lg border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </label>
        </FilterBar>
      </div>

      {total === 0 && !params.from && !params.to && !params.method && !params.programId ? (
        <div className="px-4 sm:px-6">
          <EmptyState
            icon={<IndianRupee className="size-5" />}
            title="No payments recorded"
            description="Payments are recorded against an enrollment, which generates a receipt number."
          />
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={rows as unknown as Row[]}
            rowKey={(row) => row.id}
            rowHref={(row) => `/contacts/${row.contactId}`}
            empty="No payments in this range."
          />
          <Pagination
            action="/payments"
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
