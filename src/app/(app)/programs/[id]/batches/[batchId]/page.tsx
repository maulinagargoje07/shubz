import Link from "next/link"
import { notFound } from "next/navigation"
import { CalendarDays, ClipboardCheck, MapPin, Pencil, Plus, Video } from "lucide-react"

import { Button } from "@/components/ui/button"
import { EmptyState, StatTile, StatusPill } from "@/components/ui/status"
import { PageHeader, SectionHeading } from "@/components/page-header"
import { formatDate, formatIST } from "@/lib/fy"
import { BATCH_STATUS_LABELS, SESSION_STATUS_LABELS } from "@/lib/labels"
import { programKindLabel } from "@/lib/programs"
import { batchAttendanceOverview, getBatchWithProgram } from "@/server/batches/queries"
import { BatchAttendance } from "@/components/sessions/batch-attendance"
import {
  listSchedulableBatches,
  listSessionsForBatch,
  nextSessionSeq,
} from "@/server/sessions/queries"
import { ScheduleSessionsDialog } from "@/components/sessions/schedule-sessions-dialog"
import { SessionFormDialog } from "./session-form"

export const dynamic = "force-dynamic"

export default async function BatchDetailPage({
  params,
}: {
  params: Promise<{ id: string; batchId: string }>
}) {
  const { id, batchId } = await params
  const row = await getBatchWithProgram(batchId)
  if (!row) notFound()

  const { batch, program } = row
  const isOnline = program.deliveryMode === "ONLINE"
  const [sessions, nextSeq, schedulable, overview] = await Promise.all([
    listSessionsForBatch(batchId),
    nextSessionSeq(batchId),
    listSchedulableBatches(),
    batchAttendanceOverview(batchId),
  ])

  return (
    <div className="pb-8">
      <PageHeader
        back={{ href: `/programs/${id}`, label: program.name }}
        title={batch.name}
        description={`${programKindLabel(program)} · ${batch.code}`}
        actions={
          <>
            <Button
              variant="outline"
              render={<Link href={`/programs/${id}/batches/${batchId}/edit`} />}
            >
              <Pencil className="size-4" />
              Edit
            </Button>
            {/* Bulk first: a batch is usually scheduled as a run, not one class. */}
            <ScheduleSessionsDialog batches={schedulable} defaultBatchId={batchId} />
            <SessionFormDialog
              batchId={batchId}
              deliveryMode={program.deliveryMode}
              nextSeq={nextSeq}
              trigger={
                <Button variant="outline">
                  <Plus className="size-4" />
                  Add one
                </Button>
              }
            />
          </>
        }
      />

      <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <StatTile
          label="Status"
          value={BATCH_STATUS_LABELS[batch.status] ?? batch.status}
        />
        <StatTile
          label="Runs"
          value={batch.startDate ? formatDate(batch.startDate) : "—"}
          hint={batch.endDate ? `until ${formatDate(batch.endDate)}` : undefined}
        />
        <StatTile label="Timing" value={batch.timingText ?? "—"} />

        {/* Only the field belonging to this delivery mode is shown. */}
        <StatTile
          label={isOnline ? "Meeting link" : "Venue"}
          icon={isOnline ? <Video className="size-3.5" /> : <MapPin className="size-3.5" />}
          value={
            isOnline ? (
              batch.meetingLink ? (
                <a
                  href={batch.meetingLink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-base underline underline-offset-4"
                >
                  Join
                </a>
              ) : (
                "—"
              )
            ) : (
              <span className="text-base">{batch.venueName ?? "—"}</span>
            )
          }
          hint={!isOnline && batch.venueAddress ? batch.venueAddress : undefined}
        />
      </div>

      <section className="px-4 sm:px-6">
        <SectionHeading>Sessions</SectionHeading>

        {sessions.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="size-5" />}
            title="No sessions scheduled"
            description="Schedule the run of classes for this batch — pick the days and how many, and they are created together."
            action={
              <ScheduleSessionsDialog batches={schedulable} defaultBatchId={batchId} />
            }
          />
        ) : (
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {sessions.map((session) => (
              <li
                key={session.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3"
              >
                <span className="w-6 shrink-0 tabular-nums text-sm text-muted-foreground">
                  {session.seq}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{session.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatIST(session.scheduledAt)} · {session.durationMinutes} min
                  </p>
                </div>

                <StatusPill tone={session.status === "COMPLETED" ? "paid" : "neutral"}>
                  {SESSION_STATUS_LABELS[session.status] ?? session.status}
                </StatusPill>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    render={<Link href={`/attendance/${session.id}`} />}
                  >
                    <ClipboardCheck className="size-4" />
                    <span className="hidden sm:inline">
                      {session.markedCount > 0 ? `${session.markedCount} marked` : "Mark"}
                    </span>
                  </Button>

                  <SessionFormDialog
                    batchId={batchId}
                    deliveryMode={program.deliveryMode}
                    nextSeq={nextSeq}
                    session={{
                      ...session,
                      batchId,
                      createdAt: new Date(),
                      updatedAt: new Date(),
                    }}
                    trigger={
                      <Button variant="ghost" size="icon" aria-label={`Edit ${session.title}`}>
                        <Pencil className="size-4" />
                      </Button>
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8 px-4 sm:px-6">
        <SectionHeading
          action={
            <Link
              href="/attendance"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              All registers
            </Link>
          }
        >
          Attendance
        </SectionHeading>
        <BatchAttendance
          sessions={overview.sessions}
          students={overview.students}
          heldCount={overview.heldCount}
        />
      </section>
    </div>
  )
}
