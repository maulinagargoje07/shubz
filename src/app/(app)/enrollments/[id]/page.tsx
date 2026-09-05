import Link from "next/link"
import { notFound } from "next/navigation"
import { IndianRupee, Pencil, Receipt } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/page-header"
import { formatDate } from "@/lib/fy"
import { formatINR } from "@/lib/money"
import {
  ENROLLMENT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  SCHEDULE_STATUS_LABELS,
} from "@/lib/labels"
import { billingCycleLabel, programKindLabelOf } from "@/lib/programs"
import { getEnrollment, listSchedule } from "@/server/enrollments/queries"
import { listPaymentsForEnrollment } from "@/server/payments/queries"
import { RecordPaymentDialog } from "../../payments/payment-form"

export const dynamic = "force-dynamic"

export default async function EnrollmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const enrollment = await getEnrollment(id)
  if (!enrollment) notFound()

  const [schedule, payments] = await Promise.all([
    listSchedule(id),
    listPaymentsForEnrollment(id),
  ])

  const balance = Number(enrollment.balanceDuePaise)
  const isRecurring = enrollment.billingType === "RECURRING"

  return (
    <div>
      <PageHeader
        title={String(enrollment.contactName)}
        description={`${enrollment.programName} · ${programKindLabelOf(enrollment.programType, enrollment.deliveryMode)}${
          enrollment.batchName ? ` · ${enrollment.batchName}` : ""
        }${enrollment.seatNumber ? ` · Seat ${enrollment.seatNumber}` : ""}`}
        actions={
          <>
            <Button variant="outline" render={<Link href={`/enrollments/${id}/edit`} />}>
              <Pencil className="size-4" />
              Edit
            </Button>
            <RecordPaymentDialog
              enrollmentId={id}
              balanceDuePaise={balance}
              nextDueAmountPaise={
                enrollment.nextDueAmountPaise ? Number(enrollment.nextDueAmountPaise) : null
              }
              trigger={
                <Button>
                  <IndianRupee className="size-4" />
                  Record payment
                </Button>
              }
            />
          </>
        }
      />

      <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={isRecurring ? "Per cycle" : "Net payable"}>
          {formatINR(Number(enrollment.netPayablePaise))}
          {isRecurring && enrollment.billingCycle ? (
            <span className="text-sm font-normal text-muted-foreground">
              {" "}
              total raised
            </span>
          ) : null}
        </Stat>
        <Stat label="Paid">{formatINR(Number(enrollment.totalPaidPaise))}</Stat>
        <Stat label="Remaining">
          <span className={balance > 0 ? "" : "text-muted-foreground"}>
            {formatINR(balance)}
          </span>
        </Stat>
        <Stat label="Next due">
          {enrollment.isOverdue ? (
            <span className="text-rose-600 dark:text-rose-400">
              {String(enrollment.daysOverdue)} days overdue
            </span>
          ) : enrollment.nextDueDate ? (
            formatDate(String(enrollment.nextDueDate))
          ) : (
            "—"
          )}
        </Stat>
      </div>

      <div className="grid gap-6 px-6 pb-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {isRecurring ? "Billing cycles" : "Payment schedule"}
          </h2>
          {schedule.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No schedule — the fee is payable in full.
              </CardContent>
            </Card>
          ) : (
            <div className="divide-y rounded-lg border text-sm">
              {schedule.map((row) => (
                <div key={row.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-6 shrink-0 tabular-nums text-muted-foreground">
                    {row.seq}
                  </span>
                  <span className="flex-1">{formatDate(row.dueDate)}</span>
                  <span className="tabular-nums">{formatINR(row.amountPaise)}</span>
                  <Badge
                    variant="secondary"
                    className={
                      row.status === "OVERDUE"
                        ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200"
                        : row.status === "PAID"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                          : ""
                    }
                  >
                    {SCHEDULE_STATUS_LABELS[row.status] ?? row.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Payments
          </h2>
          {payments.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Nothing recorded yet.
              </CardContent>
            </Card>
          ) : (
            <div className="divide-y rounded-lg border text-sm">
              {payments.map((payment) => (
                <div key={payment.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="tabular-nums">{formatINR(payment.amountPaise)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(payment.paidOn)} · {PAYMENT_METHOD_LABELS[payment.method]}
                      {payment.referenceNo ? ` · ${payment.referenceNo}` : ""}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    render={<Link href={`/payments/${payment.id}/receipt`} />}
                  >
                    <Receipt className="size-4" />
                    {payment.receiptNo}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="px-6 pb-8 text-sm text-muted-foreground">
        <p>
          Enrolled {formatDate(String(enrollment.enrolledOn))} ·{" "}
          {ENROLLMENT_STATUS_LABELS[enrollment.status as keyof typeof ENROLLMENT_STATUS_LABELS]}
          {isRecurring && enrollment.billingCycle
            ? ` · ${billingCycleLabel(enrollment.billingCycle)} billing`
            : ""}
          {Number(enrollment.discountPaise) > 0
            ? ` · Discount ${formatINR(Number(enrollment.discountPaise))}`
            : ""}
        </p>
        {enrollment.notes ? <p className="mt-2">{String(enrollment.notes)}</p> : null}
      </div>
    </div>
  )
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{children}</p>
    </div>
  )
}
