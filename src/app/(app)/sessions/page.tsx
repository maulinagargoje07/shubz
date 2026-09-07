import Link from "next/link"
import { CalendarDays, ClipboardCheck, MapPin, Video } from "lucide-react"

import { Button } from "@/components/ui/button"
import { EmptyState, StatusPill } from "@/components/ui/status"
import { PageHeader } from "@/components/page-header"
import { formatIST } from "@/lib/fy"
import { SESSION_STATUS_LABELS } from "@/lib/labels"
import { programKindSuffixOf } from "@/lib/programs"
import { listAllSessions, listSchedulableBatches } from "@/server/sessions/queries"
import { ScheduleSessionsDialog } from "@/components/sessions/schedule-sessions-dialog"

export const dynamic = "force-dynamic"
export const metadata = { title: "Sessions" }

export default async function SessionsPage() {
  const [sessions, schedulable] = await Promise.all([
    listAllSessions(100),
    listSchedulableBatches(),
  ])

  return (
    <div className="pb-8">
      <PageHeader
        title="Sessions"
        description="Every class across all batches, most recent first."
        // Sessions could previously only be created from four levels down,
        // inside a batch. This is the obvious place to look for it.
        actions={<ScheduleSessionsDialog batches={schedulable} />}
      />

      <div className="px-4 py-4 sm:px-6">
        {sessions.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="size-5" />}
            title="No sessions scheduled"
            description="Schedule a run of classes for a batch — pick the days and how many, and they are all created at once."
            action={<ScheduleSessionsDialog batches={schedulable} />}
          />
        ) : (
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {sessions.map((session) => (
              <li
                key={session.id}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40"
              >
                {session.deliveryMode === "ONLINE" ? (
                  <Video className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                ) : (
                  <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                )}

                <Link
                  href={`/programs/${session.programId}/batches/${session.batchId}`}
                  className="min-w-0 flex-1"
                >
                  <p className="truncate text-sm font-medium">
                    <span className="text-muted-foreground">{session.seq}. </span>
                    {session.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[
                      session.programName,
                      programKindSuffixOf(
                        session.programName,
                        session.programType,
                        session.deliveryMode
                      ),
                      session.batchName,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground sm:hidden">
                    {formatIST(session.scheduledAt)}
                  </p>
                </Link>

                <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                  {formatIST(session.scheduledAt)}
                </span>

                <StatusPill
                  tone={session.status === "COMPLETED" ? "paid" : "neutral"}
                  className="hidden sm:inline-flex"
                >
                  {SESSION_STATUS_LABELS[session.status] ?? session.status}
                </StatusPill>

                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Mark attendance for ${session.title}`}
                  render={<Link href={`/attendance/${session.id}`} />}
                >
                  <ClipboardCheck className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
