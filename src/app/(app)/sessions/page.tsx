import Link from "next/link"
import { ClipboardCheck, MapPin, Video } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/page-header"
import { formatIST } from "@/lib/fy"
import { SESSION_STATUS_LABELS } from "@/lib/labels"
import { programKindLabelOf } from "@/lib/programs"
import { listAllSessions } from "@/server/sessions/queries"

export const dynamic = "force-dynamic"
export const metadata = { title: "Sessions" }

export default async function SessionsPage() {
  const sessions = await listAllSessions(100)

  return (
    <div>
      <PageHeader
        title="Sessions"
        description="Every class across all batches, most recent first."
      />

      <div className="px-6 pb-8">
        {sessions.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No sessions scheduled yet. Add one from a batch.
            </CardContent>
          </Card>
        ) : (
          <div className="divide-y rounded-lg border">
            {sessions.map((session) => (
              <div key={session.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                {session.deliveryMode === "ONLINE" ? (
                  <Video className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                ) : (
                  <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    <span className="text-muted-foreground">{session.seq}. </span>
                    {session.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <Link
                      href={`/programs/${session.programId}/batches/${session.batchId}`}
                      className="hover:underline"
                    >
                      {session.programName} ·{" "}
                      {programKindLabelOf(session.programType, session.deliveryMode)} ·{" "}
                      {session.batchName}
                    </Link>
                  </p>
                </div>

                <span className="text-xs text-muted-foreground">
                  {formatIST(session.scheduledAt)}
                </span>

                <Badge variant="secondary">
                  {SESSION_STATUS_LABELS[session.status] ?? session.status}
                </Badge>

                <Button
                  variant="ghost"
                  size="sm"
                  render={<Link href={`/attendance/${session.id}`} />}
                >
                  <ClipboardCheck className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
