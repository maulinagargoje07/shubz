import Link from "next/link"
import { CalendarDays, MapPin, Video } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/page-header"
import { formatIST } from "@/lib/fy"
import { formatINRShort } from "@/lib/money"
import { programKindLabelOf, programTypeLabel } from "@/lib/programs"
import {
  activeBatchCount,
  activeStudentCount,
  activeStudentsByProgramKind,
  totalContacts,
} from "@/server/dashboard/queries"
import { collectedThisMonth, overdueCount, totalOutstanding } from "@/server/fees/queries"
import { countUpcomingSessions, listUpcomingSessions } from "@/server/sessions/queries"

export const dynamic = "force-dynamic"
export const metadata = { title: "Dashboard" }

export default async function DashboardPage() {
  const [
    contacts,
    students,
    batches,
    upcomingCount,
    collected,
    outstanding,
    overdue,
    byKind,
    upcoming,
  ] = await Promise.all([
    totalContacts(),
    activeStudentCount(),
    activeBatchCount(),
    countUpcomingSessions(7),
    collectedThisMonth(),
    totalOutstanding(),
    overdueCount(),
    activeStudentsByProgramKind(),
    listUpcomingSessions(7),
  ])

  return (
    <div>
      <PageHeader title="Dashboard" description="Where things stand today." />

      <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total contacts" value={String(contacts)} href="/contacts" />
        <Stat label="Active students" value={String(students)} href="/students" />
        <Stat label="Active batches" value={String(batches)} href="/programs" />
        <Stat
          label="Sessions next 7 days"
          value={String(upcomingCount)}
          href="/attendance"
        />
        <Stat
          label="Collected this month"
          value={formatINRShort(collected)}
          href="/payments"
        />
        <Stat label="Outstanding" value={formatINRShort(outstanding)} href="/fees" />
        <Stat
          label="Overdue"
          value={String(overdue)}
          href="/fees"
          tone={overdue > 0 ? "danger" : undefined}
        />
      </div>

      <div className="grid gap-6 px-6 pb-10 lg:grid-cols-2">
        {/*
          The split that justifies storing type and delivery mode as two
          independent columns: it answers "how many on mentorship" and "how many
          attend offline" from the same rows.
        */}
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Active students by program
          </h2>
          {byKind.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No active enrollments yet.
              </CardContent>
            </Card>
          ) : (
            <div className="divide-y rounded-lg border text-sm">
              {byKind.map((row) => (
                <div
                  key={`${row.type}-${row.deliveryMode}`}
                  className="flex items-center gap-3 px-4 py-2.5"
                >
                  {row.deliveryMode === "ONLINE" ? (
                    <Video className="size-4 text-muted-foreground" aria-hidden />
                  ) : (
                    <MapPin className="size-4 text-muted-foreground" aria-hidden />
                  )}
                  <span className="flex-1">
                    {programKindLabelOf(row.type, row.deliveryMode)}
                  </span>
                  <span className="tabular-nums font-medium">{row.studentCount}</span>
                </div>
              ))}

              <div className="flex items-center gap-3 bg-muted/30 px-4 py-2.5 text-muted-foreground">
                <span className="flex-1">
                  Offline total ·{" "}
                  {byKind
                    .filter((r) => r.deliveryMode === "OFFLINE")
                    .map((r) => programTypeLabel(r.type))
                    .join(", ") || "none"}
                </span>
                <span className="tabular-nums font-medium text-foreground">
                  {byKind
                    .filter((r) => r.deliveryMode === "OFFLINE")
                    .reduce((sum, r) => sum + r.studentCount, 0)}
                </span>
              </div>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Next 7 days
          </h2>
          {upcoming.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Nothing scheduled this week.
              </CardContent>
            </Card>
          ) : (
            <div className="divide-y rounded-lg border text-sm">
              {upcoming.map((session) => (
                <Link
                  key={session.id}
                  href={`/attendance/${session.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30"
                >
                  <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{session.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {session.programName} ·{" "}
                      {programKindLabelOf(session.programType, session.deliveryMode)}
                      {session.venueName ? ` · ${session.venueName}` : ""}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {formatIST(session.scheduledAt, "d MMM, h:mm a")}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  href,
  tone,
}: {
  label: string
  value: string
  href: string
  tone?: "danger"
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border p-4 transition-colors hover:bg-muted/40"
    >
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          tone === "danger" ? "text-rose-600 dark:text-rose-400" : ""
        }`}
      >
        {value}
      </p>
    </Link>
  )
}
