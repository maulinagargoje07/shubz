import Link from "next/link"
import { notFound } from "next/navigation"
import { Pencil, Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/page-header"
import { formatDate, formatIST } from "@/lib/fy"
import { formatINR } from "@/lib/money"
import { formatE164 } from "@/lib/phone-format"
import {
  ATTENDANCE_LABELS,
  ENROLLMENT_STATUS_LABELS,
  LIFECYCLE_LABELS,
  LIFECYCLE_TONES,
  PAYMENT_METHOD_LABELS,
  SOURCE_LABELS,
} from "@/lib/labels"
import { programKindLabelOf } from "@/lib/programs"
import { diffFields } from "@/lib/audit"
import {
  contactAttendanceRate,
  listAttendanceForContact,
} from "@/server/attendance/queries"
import {
  currentConsent,
  listActivityForContact,
  listNotesForContact,
} from "@/server/contacts/detail"
import { getContact } from "@/server/contacts/queries"
import { listEnrollmentsForContact } from "@/server/enrollments/queries"
import { listPaymentsForContact } from "@/server/payments/queries"
import { AddNote } from "./add-note"

export const dynamic = "force-dynamic"

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const contact = await getContact(id)
  if (!contact) notFound()

  const [enrollments, payments, attendanceRows, rate, notes, consent, activity] =
    await Promise.all([
      listEnrollmentsForContact(id),
      listPaymentsForContact(id),
      listAttendanceForContact(id),
      contactAttendanceRate(id),
      listNotesForContact(id),
      currentConsent(id),
      listActivityForContact(id),
    ])

  const totalPaid = payments.reduce((sum, p) => sum + p.amountPaise, 0)
  const totalDue = enrollments.reduce(
    (sum, e) => sum + Math.max(Number(e.balanceDuePaise), 0),
    0
  )

  return (
    <div>
      <PageHeader
        title={contact.fullName}
        description={`${formatE164(contact.phoneE164)}${contact.city ? ` · ${contact.city}` : ""}`}
        actions={
          <>
            <Button variant="outline" render={<Link href={`/contacts/${id}/edit`} />}>
              <Pencil className="size-4" />
              Edit
            </Button>
            <Button render={<Link href="/enrollments/new" />}>
              <Plus className="size-4" />
              Enroll
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap gap-2 px-6 pt-4">
        <Badge variant="secondary" className={LIFECYCLE_TONES[contact.lifecycleStage]}>
          {LIFECYCLE_LABELS[contact.lifecycleStage]}
        </Badge>
        <Badge variant="secondary">{SOURCE_LABELS[contact.source]}</Badge>
        {consent.map((event) => (
          <Badge
            key={event.id}
            variant="secondary"
            className={
              event.action === "OPT_OUT"
                ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200"
                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
            }
          >
            {event.channel} {event.action === "OPT_IN" ? "opted in" : "opted out"}
          </Badge>
        ))}
      </div>

      <Tabs defaultValue="overview" className="p-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="enrollments">Enrollments</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Enrollments">{enrollments.length}</Stat>
            <Stat label="Total paid">{formatINR(totalPaid)}</Stat>
            <Stat label="Outstanding">{formatINR(totalDue)}</Stat>
            <Stat label="Attendance">
              {rate.percent === null ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                <>
                  {rate.percent}%
                  <span className="block text-xs font-normal text-muted-foreground">
                    {rate.attended} of {rate.eligible} sessions held
                  </span>
                </>
              )}
            </Stat>
          </div>

          <dl className="mt-6 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Phone">{formatE164(contact.phoneE164)}</Field>
            {contact.altPhone ? (
              <Field label="Alternate">{formatE164(contact.altPhone)}</Field>
            ) : null}
            {contact.email ? <Field label="Email">{contact.email}</Field> : null}
            {contact.city ? <Field label="City">{contact.city}</Field> : null}
            {contact.state ? <Field label="State">{contact.state}</Field> : null}
            {contact.telegramUsername ? (
              <Field label="Telegram">{contact.telegramUsername}</Field>
            ) : null}
            {contact.tradingviewUsername ? (
              <Field label="TradingView">{contact.tradingviewUsername}</Field>
            ) : null}
            <Field label="Added">{formatIST(contact.createdAt)}</Field>
          </dl>

          {contact.notes ? (
            <p className="mt-6 whitespace-pre-wrap text-sm text-muted-foreground">
              {contact.notes}
            </p>
          ) : null}
        </TabsContent>

        <TabsContent value="enrollments" className="mt-4">
          {enrollments.length === 0 ? (
            <Empty>Not enrolled in anything yet.</Empty>
          ) : (
            <div className="divide-y rounded-lg border text-sm">
              {enrollments.map((row) => (
                <Link
                  key={String(row.id)}
                  href={`/enrollments/${row.id}`}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-muted/30"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{String(row.programName)}</p>
                    <p className="text-xs text-muted-foreground">
                      {programKindLabelOf(row.programType, row.deliveryMode)}
                      {row.batchName ? ` · ${row.batchName}` : ""}
                      {row.seatNumber ? ` · Seat ${row.seatNumber}` : ""}
                    </p>
                  </div>
                  <span className="tabular-nums">
                    {formatINR(Number(row.totalPaidPaise))} /{" "}
                    {formatINR(Number(row.netPayablePaise))}
                  </span>
                  {row.isOverdue ? (
                    <Badge
                      variant="secondary"
                      className="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200"
                    >
                      {String(row.daysOverdue)}d overdue
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      {
                        ENROLLMENT_STATUS_LABELS[
                          row.status as keyof typeof ENROLLMENT_STATUS_LABELS
                        ]
                      }
                    </Badge>
                  )}
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          {payments.length === 0 ? (
            <Empty>No payments recorded.</Empty>
          ) : (
            <div className="divide-y rounded-lg border text-sm">
              {payments.map((payment) => (
                <div key={payment.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <Link
                    href={`/payments/${payment.id}/receipt`}
                    className="font-mono text-xs hover:underline"
                  >
                    {payment.receiptNo}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium tabular-nums">
                      {formatINR(payment.amountPaise)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {payment.programName} ·{" "}
                      {programKindLabelOf(payment.programType, payment.deliveryMode)}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(payment.paidOn)} · {PAYMENT_METHOD_LABELS[payment.method]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="attendance" className="mt-4">
          <div className="mb-4 rounded-lg border p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Attendance rate
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {rate.percent === null ? "—" : `${rate.percent}%`}
            </p>
            <p className="text-xs text-muted-foreground">
              {rate.percent === null
                ? "No sessions have been held yet."
                : `Present or late at ${rate.attended} of ${rate.eligible} sessions held. Excused absences are excluded.`}
            </p>
          </div>

          {attendanceRows.length === 0 ? (
            <Empty>No attendance marked yet.</Empty>
          ) : (
            <div className="divide-y rounded-lg border text-sm">
              {attendanceRows.map((row) => (
                <div key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{row.sessionTitle}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.programName} · {row.batchName} · {formatIST(row.scheduledAt)}
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={
                      row.status === "PRESENT"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                        : row.status === "ABSENT"
                          ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200"
                          : ""
                    }
                  >
                    {ATTENDANCE_LABELS[row.status]}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="notes" className="mt-4 max-w-2xl space-y-4">
          <AddNote contactId={id} />
          {notes.length === 0 ? (
            <Empty>No notes yet.</Empty>
          ) : (
            <div className="divide-y rounded-lg border text-sm">
              {notes.map((note) => (
                <div key={note.id} className="px-4 py-3">
                  <p className="whitespace-pre-wrap">{note.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {note.authorName ?? "Unknown"} · {formatIST(note.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          {activity.length === 0 ? (
            <Empty>No recorded changes.</Empty>
          ) : (
            <div className="divide-y rounded-lg border text-sm">
              {activity.map((entry) => {
                const changed = diffFields(
                  entry.before as Record<string, unknown> | null,
                  entry.after as Record<string, unknown> | null
                )
                return (
                  <div key={entry.id} className="px-4 py-3">
                    <p>
                      <span className="font-medium">{entry.action}</span>
                      {changed.length > 0 ? (
                        <span className="text-muted-foreground">
                          {" "}
                          · {changed.join(", ")}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {entry.actorName ?? "System"} · {formatIST(entry.createdAt)}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{children}</p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="py-10 text-center text-sm text-muted-foreground">
        {children}
      </CardContent>
    </Card>
  )
}
