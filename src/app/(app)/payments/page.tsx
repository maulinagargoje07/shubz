import { DataTablePagination } from "@/components/data-table/pagination"
import { FilterBar } from "@/components/data-table/filter-bar"
import { PageHeader } from "@/components/page-header"
import { formatINR } from "@/lib/money"
import { PAYMENT_METHOD_LABELS, toOptions } from "@/lib/labels"
import { paymentListParamsSchema } from "@/lib/validation/payment"
import { listPayments } from "@/server/payments/queries"
import { listPrograms } from "@/server/programs/queries"
import { DateRangeFilter } from "./date-range-filter"
import { PaymentsTable, type PaymentRow } from "./payments-table"

export const dynamic = "force-dynamic"
export const metadata = { title: "Payments" }

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const raw = await searchParams
  const params = paymentListParamsSchema.parse({
    from: typeof raw.from === "string" && raw.from ? raw.from : undefined,
    to: typeof raw.to === "string" && raw.to ? raw.to : undefined,
    method: typeof raw.method === "string" ? raw.method : undefined,
    programId: typeof raw.program === "string" ? raw.program : undefined,
    page: raw.page ?? 1,
    perPage: 25,
  })

  const [{ rows, total, sumPaise }, programs] = await Promise.all([
    listPayments(params),
    listPrograms(),
  ])

  return (
    <div>
      <PageHeader
        title="Payments"
        description={`${total} payment${total === 1 ? "" : "s"} · ${formatINR(sumPaise)} in this view`}
      />

      <FilterBar
        showSearch={false}
        filters={[
          { key: "method", label: "Method", options: toOptions(PAYMENT_METHOD_LABELS) },
          {
            key: "program",
            label: "Program",
            options: programs.map((p) => ({ value: p.id, label: p.name })),
          },
        ]}
      />

      <DateRangeFilter />

      <PaymentsTable rows={rows as unknown as PaymentRow[]} />
      <DataTablePagination page={params.page} perPage={params.perPage} total={total} />
    </div>
  )
}
