import Link from "next/link"
import { notFound } from "next/navigation"
import { IndianRupee, Pencil, Receipt } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  EmptyState,
  StatTile,
  StatusPill,
  enrollmentTone,
  scheduleTone,
} from "@/components/ui/status"
import { PageHeader, SectionHeading } from "@/components/page-header"
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
    <div className="pb-8">
      <PageHeader
        back={{ href: "/enrollments", label: "Enrollments" }}
        title={String(enrollment.contactName)}
        description={`${enrollment.programName} · ${programKindLabelOf(
          enrollment.programType,
          enrollment.deliveryMode
        )}${enrollment.batchName ? ` · ${enrollment.batchName}` : ""}${
          enrollment.seatNumber ? ` · Seat ${enrollment.seatNumber}` : ""
        }`}
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

      <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <StatTile
          label={isRecurring ? "Raised to date" : "Net payable"}
          value={formatINR(Number(enrollment.netPayablePaise))}
          hint={
            isRecurring && enrollment.billingCycle
              ? `${formatINR(Number(enrollment.feeTotalPaise) - Number(enrollment.discountPaise))} per ${billingCycleLabel(enrollment.billingCycle).toLowerCase()}`
              : Number(enrollment.discountPaise) > 0
                ? `After ${formatINR(Number(enrollment.discountPaise))} discount`
                : undefined
          }
        />
        <StatTile label="Paid" value={formatINR(Number(enrollment.totalPaidPaise))} />
        <StatTile
          label="Remaining"
          value={formatINR(balance)}
          tone={balance > 0 ? (enrollment.isOverdue ? "overdue" : undefined) : "paid"}
        />
        <StatTile
          label="Next due"
          value={
            enrollment.isOverdue
              ? `${String(enrollment.daysOverdue)} days late`
              : enrollment.nextDueDate
                ? formatDate(String(enrollment.nextDueDate))
                : "—"
          }
          tone={enrollment.isOverdue ? "overdue" : undefined}
          hint={
            enrollment.nextDueAmountPaise
              ? formatINR(Number(enrollment.nextDueAmountPaise))
              : undefined
          }
        />
      </div>

      <div className="grid gap-6 px-4 sm:px-6 lg:grid-cols-2">
        <section>
          <SectionHeading>
            {isRecurring ? "Billing cycles" : "Payment schedule"}
          </SectionHeading>

          {schedule.length === 0 ? (
            <EmptyState title="No schedule" description="The fee is payable in full." />
          ) : (
            <ul className="divide-y overflow-hidden rounded-xl border bg-card text-sm">
              {schedule.map((row) => (
                <li key={row.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-5 shrink-0 tabular-nums text-muted-foreground">
                    {row.seq}
                  </span>
                  <span className="flex-1">{formatDate(row.dueDate)}</span>
                  <span className="tabular-nums">{formatINR(row.amountPaise)}</span>
                  <StatusPill tone={scheduleTone(row.status)}>
                    {SCHEDULE_STATUS_LABELS[row.status] ?? row.status}
                  </StatusPill>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <SectionHeading>Payments</SectionHeading>

          {payments.length === 0 ? (
            <EmptyState
              icon={<Receipt className="size-5" />}
              title="Nothing recorded yet"
              description="Recording a payment generates a receipt number and updates the schedule."
            />
          ) : (
            <ul className="divide-y overflow-hidden rounded-xl border bg-card text-sm">
              {payments.map((payment) => (
                <li key={payment.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium tabular-nums">
                      {formatINR(payment.amountPaise)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatDate(payment.paidOn)} · {PAYMENT_METHOD_LABELS[payment.method]}
                      {payment.referenceNo ? ` · ${payment.referenceNo}` : ""}
                    </p>
                  </div>
                  <Link
                    href={`/payments/${payment.id}/receipt`}
                    className="shrink-0 font-mono text-xs hover:underline"
                  >
                    {payment.receiptNo}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 px-4 text-sm text-muted-foreground sm:px-6">
        <StatusPill tone={enrollmentTone(String(enrollment.status))}>
          {ENROLLMENT_STATUS_LABELS[enrollment.status as keyof typeof ENROLLMENT_STATUS_LABELS]}
        </StatusPill>
        <span>Enrolled {formatDate(String(enrollment.enrolledOn))}</span>
        {isRecurring && enrollment.billingCycle ? (
          <span>· {billingCycleLabel(enrollment.billingCycle)} billing</span>
        ) : null}
      </div>

      {enrollment.notes ? (
        <p className="mt-3 px-4 text-sm text-muted-foreground sm:px-6">
          {String(enrollment.notes)}
        </p>
      ) : null}
    </div>
  )
}
