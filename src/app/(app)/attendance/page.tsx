import Link from "next/link"
import { ClipboardCheck, MapPin, Video } from "lucide-react"

import { EmptyState, StatusPill } from "@/components/ui/status"
import { PageHeader } from "@/components/page-header"
import { formatIST } from "@/lib/fy"
import { programKindLabelOf } from "@/lib/programs"
import { listAllSessions } from "@/server/sessions/queries"

export const dynamic = "force-dynamic"
export const metadata = { title: "Attendance" }

export default async function AttendancePage() {
  const sessions = await listAllSessions(60)

  return (
    <div className="pb-8">
      <PageHeader title="Attendance" description="Pick a session to mark its register." />

      <div className="px-4 py-4 sm:px-6">
        {sessions.length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck className="size-5" />}
            title="No sessions to mark"
            description="Attendance is marked per session, and sessions are added inside a batch."
          />
        ) : (
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {sessions.map((session) => {
              const marked = session.markedCount > 0

              return (
                <li key={session.id}>
                  {/*
                    The whole row is the tap target rather than a small button
                    at the end — on a phone this list is used at arm's length
                    while a class files in.
                  */}
                  <Link
                    href={`/attendance/${session.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40 active:bg-accent/60"
                  >
                    {session.deliveryMode === "ONLINE" ? (
                      <Video className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    ) : (
                      <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{session.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {session.programName} ·{" "}
                        {programKindLabelOf(session.programType, session.deliveryMode)} ·{" "}
                        {session.batchName}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatIST(session.scheduledAt)}
                      </p>
                    </div>

                    <StatusPill tone={marked ? "paid" : "pending"}>
                      {marked
                        ? `${session.markedCount}/${session.enrolledCount}`
                        : `${session.enrolledCount} to mark`}
                    </StatusPill>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
