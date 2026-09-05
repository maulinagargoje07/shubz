import Link from "next/link"
import { ClipboardCheck } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/page-header"
import { formatIST } from "@/lib/fy"
import { SESSION_STATUS_LABELS } from "@/lib/labels"
import { programKindLabelOf } from "@/lib/programs"
import { listAllSessions } from "@/server/sessions/queries"

export const dynamic = "force-dynamic"
export const metadata = { title: "Attendance" }

export default async function AttendancePage() {
  const sessions = await listAllSessions(60)

  return (
    <div>
      <PageHeader
        title="Attendance"
        description="Pick a session to mark its register."
      />

      <div className="px-6 pb-8">
        {sessions.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No sessions scheduled yet.
            </CardContent>
          </Card>
        ) : (
          <div className="divide-y rounded-lg border">
            {sessions.map((session) => (
              <div key={session.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{session.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {session.programName} ·{" "}
                    {programKindLabelOf(session.programType, session.deliveryMode)} ·{" "}
                    {session.batchName} · {formatIST(session.scheduledAt)}
                  </p>
                </div>

                <Badge variant="secondary">
                  {SESSION_STATUS_LABELS[session.status] ?? session.status}
                </Badge>

                <span className="text-xs text-muted-foreground">
                  {session.markedCount > 0
                    ? `${session.markedCount}/${session.enrolledCount} marked`
                    : `${session.enrolledCount} enrolled`}
                </span>

                <Button variant="outline" size="sm" render={<Link href={`/attendance/${session.id}`} />}>
                  <ClipboardCheck className="size-4" />
                  {session.markedCount > 0 ? "Review" : "Mark"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
