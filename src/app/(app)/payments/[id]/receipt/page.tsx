import { notFound } from "next/navigation"

import { formatDate, financialYearLabel } from "@/lib/fy"
import { formatINR } from "@/lib/money"
import { PAYMENT_METHOD_LABELS } from "@/lib/labels"
import { programKindLabelOf } from "@/lib/programs"
import { formatPhone } from "@/lib/phone"
import { getReceipt } from "@/server/payments/queries"
import { PrintButton } from "./print-button"

export const dynamic = "force-dynamic"
export const metadata = { title: "Receipt" }

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const receipt = await getReceipt(id)
  if (!receipt) notFound()

  return (
    <div className="mx-auto max-w-2xl p-6 print:p-0">
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>

      {/* A voided payment keeps its receipt on file, clearly marked. */}
      {receipt.deletedAt ? (
        <p className="mb-4 rounded-md border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">
          This payment has been voided. This receipt is no longer valid.
        </p>
      ) : null}

      <article className="rounded-lg border p-8 print:rounded-none print:border-0 print:p-0">
        <header className="mb-6 flex items-start justify-between gap-4 border-b pb-6">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">ShubzTrader</h1>
            <p className="text-sm text-muted-foreground">Trading education · Pune</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Receipt</p>
            <p className="font-mono text-lg font-semibold tabular-nums">
              {receipt.receiptNo}
            </p>
            <p className="text-xs text-muted-foreground">
              FY {financialYearLabel(receipt.paidOn)}
            </p>
          </div>
        </header>

        <dl className="mb-6 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          <Row label="Received from">{receipt.contactName}</Row>
          <Row label="Phone">{formatPhone(receipt.contactPhone)}</Row>
          {receipt.contactEmail ? <Row label="Email">{receipt.contactEmail}</Row> : null}
          {receipt.contactCity ? <Row label="City">{receipt.contactCity}</Row> : null}

          <Row label="Program">
            {receipt.programName}
            <span className="block text-muted-foreground">
              {programKindLabelOf(receipt.programType, receipt.deliveryMode)}
            </span>
          </Row>
          {receipt.batchName ? <Row label="Batch">{receipt.batchName}</Row> : null}

          <Row label="Paid on">{formatDate(receipt.paidOn)}</Row>
          <Row label="Method">{PAYMENT_METHOD_LABELS[receipt.method]}</Row>
          {receipt.referenceNo ? (
            <Row label="Reference">{receipt.referenceNo}</Row>
          ) : null}
        </dl>

        <div className="flex items-baseline justify-between border-t pt-6">
          <span className="text-sm uppercase tracking-wide text-muted-foreground">
            Amount received
          </span>
          <span className="text-2xl font-semibold tabular-nums">
            {formatINR(receipt.amountPaise)}
          </span>
        </div>

        {receipt.notes ? (
          <p className="mt-6 border-t pt-4 text-sm text-muted-foreground">{receipt.notes}</p>
        ) : null}

        <footer className="mt-8 border-t pt-4 text-xs text-muted-foreground">
          <p>Computer-generated receipt. No signature required.</p>
        </footer>
      </article>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  )
}
