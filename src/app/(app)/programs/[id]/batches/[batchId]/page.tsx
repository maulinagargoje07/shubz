import Link from "next/link"
import { notFound } from "next/navigation"
import { CalendarDays, ClipboardCheck, MapPin, Pencil, Plus, Video } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/page-header"
import { formatDate, formatIST } from "@/lib/fy"
import { BATCH_STATUS_LABELS, SESSION_STATUS_LABELS } from "@/lib/labels"
import { programKindLabel } from "@/lib/programs"
import { getBatchWithProgram } from "@/server/batches/queries"
import { listSessionsForBatch, nextSessionSeq } from "@/server/sessions/queries"
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
  const [sessions, nextSeq] = await Promise.all([
    listSessionsForBatch(batchId),
    nextSessionSeq(batchId),
  ])

  return (
    <div>
      <PageHeader
        title={batch.name}
        description={`${program.name} · ${programKindLabel(program)} · ${batch.code}`}
        actions={
          <>
            <Button
              variant="outline"
              render={<Link href={`/programs/${id}/batches/${batchId}/edit`} />}
            >
              <Pencil className="size-4" />
              Edit
            </Button>
            <SessionFormDialog
              batchId={batchId}
              deliveryMode={program.deliveryMode}
              nextSeq={nextSeq}
              trigger={
                <Button>
                  <Plus className="size-4" />
                  Add session
                </Button>
              }
            />
          </>
        }
      />

      <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Status">{BATCH_STATUS_LABELS[batch.status] ?? batch.status}</Stat>
        <Stat label="Runs">
          {batch.startDate ? formatDate(batch.startDate) : "—"}
          {batch.endDate ? ` – ${formatDate(batch.endDate)}` : ""}
        </Stat>
        <Stat label="Timing">{batch.timingText ?? "—"}</Stat>
        {/* Only the field belonging to this delivery mode is shown. */}
        <Stat label={isOnline ? "Meeting link" : "Venue"}>
          {isOnline ? (
            batch.meetingLink ? (
              <a
                href={batch.meetingLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-base underline"
              >
                <Video className="size-4" />
                Join
              </a>
            ) : (
              "—"
            )
          ) : (
            <span className="inline-flex items-center gap-1.5 text-base">
              <MapPin className="size-4" />
              {batch.venueName ?? "—"}
            </span>
          )}
        </Stat>
      </div>

      <div className="px-6 pb-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Sessions
        </h2>

        {sessions.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No sessions scheduled yet.
            </CardContent>
          </Card>
        ) : (
          <div className="divide-y rounded-lg border">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
              >
                <span className="w-8 shrink-0 tabular-nums text-muted-foreground">
                  {session.seq}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{session.title}</p>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarDays className="size-3.5" />
                    {formatIST(session.scheduledAt)} · {session.durationMinutes} min
                  </p>
                </div>

                <Badge variant="secondary">
                  {SESSION_STATUS_LABELS[session.status] ?? session.status}
                </Badge>

                <span className="text-xs text-muted-foreground">
                  {session.markedCount > 0
                    ? `${session.markedCount} marked`
                    : "Not marked"}
                </span>

                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    render={<Link href={`/attendance/${session.id}`} />}
                  >
                    <ClipboardCheck className="size-4" />
                    Attendance
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
                      <Button variant="ghost" size="sm">
                        <Pencil className="size-4" />
                      </Button>
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        )}
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
