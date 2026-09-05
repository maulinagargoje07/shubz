import Link from "next/link"
import { notFound } from "next/navigation"
import { Pencil, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  EmptyState,
  StatTile,
  StatusPill,
  attendanceTone,
  enrollmentTone,
  lifecycleTone,
} from "@/components/ui/status"
import { PageHeader } from "@/components/page-header"
import { formatDate, formatIST } from "@/lib/fy"
import { formatINR } from "@/lib/money"
import { formatE164 } from "@/lib/phone-format"
import {
  ATTENDANCE_LABELS,
  ENROLLMENT_STATUS_LABELS,
  LIFECYCLE_LABELS,
  PAYMENT_METHOD_LABELS,
  SOURCE_LABELS,
} from "@/lib/labels"
import { programKindLabelOf } from "@/lib/programs"
import { diffFields } from "@/lib/audit"
import { contactAttendanceRate, listAttendanceForContact } from "@/server/attendance/queries"
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
    <div className="pb-8">
      <PageHeader
        back={{ href: "/contacts", label: "Contacts" }}
        title={contact.fullName}
        description={
          <span className="tabular-nums">
            {formatE164(contact.phoneE164)}
            {contact.city ? ` · ${contact.city}` : ""}
          </span>
        }
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

      <div className="flex flex-wrap gap-1.5 px-4 pt-4 sm:px-6">
        <StatusPill tone={lifecycleTone(contact.lifecycleStage)}>
          {LIFECYCLE_LABELS[contact.lifecycleStage]}
        </StatusPill>
        <StatusPill tone="muted">{SOURCE_LABELS[contact.source]}</StatusPill>
        {consent.map((event) => (
          <StatusPill
            key={event.id}
            tone={event.action === "OPT_OUT" ? "overdue" : "paid"}
          >
            {event.channel} {event.action === "OPT_IN" ? "opted in" : "opted out"}
          </StatusPill>
        ))}
      </div>

      <div className="px-4 py-4 sm:px-6">
        <Tabs defaultValue="overview">
          {/* The tab strip scrolls rather than wrapping to two rows on a phone. */}
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <TabsList className="w-max">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="enrollments">
                Enrollments
                {enrollments.length ? (
                  <span className="ml-1 text-muted-foreground">{enrollments.length}</span>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="payments">
                Payments
                {payments.length ? (
                  <span className="ml-1 text-muted-foreground">{payments.length}</span>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="attendance">Attendance</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="mt-4 space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile label="Enrollments" value={enrollments.length} />
              <StatTile label="Total paid" value={formatINR(totalPaid)} />
              <StatTile
                label="Outstanding"
                value={formatINR(totalDue)}
                tone={totalDue > 0 ? "overdue" : undefined}
              />
              <StatTile
                label="Attendance"
                value={rate.percent === null ? "—" : `${rate.percent}%`}
                hint={
                  rate.percent === null
                    ? "No sessions held yet"
                    : `${rate.attended} of ${rate.eligible} held`
                }
              />
            </div>

            <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Phone">
                <a href={`tel:${contact.phoneE164}`} className="tabular-nums hover:underline">
                  {formatE164(contact.phoneE164)}
                </a>
              </Field>
              {contact.altPhone ? (
                <Field label="Alternate">
                  <a href={`tel:${contact.altPhone}`} className="tabular-nums hover:underline">
                    {formatE164(contact.altPhone)}
                  </a>
                </Field>
              ) : null}
              {contact.email ? (
                <Field label="Email">
                  <a href={`mailto:${contact.email}`} className="hover:underline">
                    {contact.email}
                  </a>
                </Field>
              ) : null}
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
              <p className="whitespace-pre-wrap rounded-xl border bg-card p-4 text-sm text-muted-foreground">
                {contact.notes}
              </p>
            ) : null}
          </TabsContent>

          <TabsContent value="enrollments" className="mt-4">
            {enrollments.length === 0 ? (
              <EmptyState
                title="Not enrolled in anything yet"
                action={
                  <Button render={<Link href="/enrollments/new" />}>Create enrollment</Button>
                }
              />
            ) : (
              <ul className="divide-y overflow-hidden rounded-xl border bg-card">
                {enrollments.map((row) => (
                  <li key={String(row.id)}>
                    <Link
                      href={`/enrollments/${row.id}`}
                      className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-accent/40"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{String(row.programName)}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {programKindLabelOf(row.programType, row.deliveryMode)}
                          {row.batchName ? ` · ${row.batchName}` : ""}
                          {row.seatNumber ? ` · Seat ${row.seatNumber}` : ""}
                        </p>
                      </div>
                      <span className="tabular-nums text-muted-foreground">
                        {formatINR(Number(row.totalPaidPaise))} /{" "}
                        {formatINR(Number(row.netPayablePaise))}
                      </span>
                      {row.isOverdue ? (
                        <StatusPill tone="overdue">
                          {String(row.daysOverdue)}d overdue
                        </StatusPill>
                      ) : (
                        <StatusPill tone={enrollmentTone(String(row.status))}>
                          {
                            ENROLLMENT_STATUS_LABELS[
                              row.status as keyof typeof ENROLLMENT_STATUS_LABELS
                            ]
                          }
                        </StatusPill>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="payments" className="mt-4">
            {payments.length === 0 ? (
              <EmptyState title="No payments recorded" />
            ) : (
              <ul className="divide-y overflow-hidden rounded-xl border bg-card">
                {payments.map((payment) => (
                  <li
                    key={payment.id}
                    className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium tabular-nums">
                        {formatINR(payment.amountPaise)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {payment.programName} ·{" "}
                        {programKindLabelOf(payment.programType, payment.deliveryMode)}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(payment.paidOn)} · {PAYMENT_METHOD_LABELS[payment.method]}
                    </span>
                    <Link
                      href={`/payments/${payment.id}/receipt`}
                      className="font-mono text-xs hover:underline"
                    >
                      {payment.receiptNo}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="attendance" className="mt-4 space-y-4">
            <StatTile
              label="Attendance rate"
              value={rate.percent === null ? "—" : `${rate.percent}%`}
              hint={
                rate.percent === null
                  ? "No sessions have been held yet."
                  : `Present or late at ${rate.attended} of ${rate.eligible} sessions held. Excused absences are excluded.`
              }
            />

            {attendanceRows.length === 0 ? (
              <EmptyState title="No attendance marked yet" />
            ) : (
              <ul className="divide-y overflow-hidden rounded-xl border bg-card">
                {attendanceRows.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{row.sessionTitle}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.programName} · {row.batchName} · {formatIST(row.scheduledAt)}
                      </p>
                    </div>
                    <StatusPill tone={attendanceTone(row.status)}>
                      {ATTENDANCE_LABELS[row.status]}
                    </StatusPill>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="notes" className="mt-4 max-w-2xl space-y-4">
            <AddNote contactId={id} />
            {notes.length === 0 ? (
              <EmptyState title="No notes yet" />
            ) : (
              <ul className="divide-y overflow-hidden rounded-xl border bg-card text-sm">
                {notes.map((note) => (
                  <li key={note.id} className="px-4 py-3">
                    <p className="whitespace-pre-wrap">{note.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {note.authorName ?? "Unknown"} · {formatIST(note.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="activity" className="mt-4">
            {activity.length === 0 ? (
              <EmptyState title="No recorded changes" />
            ) : (
              <ul className="divide-y overflow-hidden rounded-xl border bg-card text-sm">
                {activity.map((entry) => {
                  const changed = diffFields(
                    entry.before as Record<string, unknown> | null,
                    entry.after as Record<string, unknown> | null
                  )
                  return (
                    <li key={entry.id} className="px-4 py-3">
                      <p>
                        <span className="font-medium">{entry.action}</span>
                        {changed.length > 0 ? (
                          <span className="text-muted-foreground"> · {changed.join(", ")}</span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {entry.actorName ?? "System"} · {formatIST(entry.createdAt)}
                      </p>
                    </li>
                  )
                })}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  )
}
