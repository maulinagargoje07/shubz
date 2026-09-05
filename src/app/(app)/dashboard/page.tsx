import Link from "next/link"
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  IndianRupee,
  MapPin,
  Users,
  Video,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { EmptyState, StatTile, StatusPill } from "@/components/ui/status"
import { PageHeader, SectionHeading } from "@/components/page-header"
import { formatIST } from "@/lib/fy"
import { formatINRShort } from "@/lib/money"
import { programKindLabelOf } from "@/lib/programs"
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

  const offlineTotal = byKind
    .filter((r) => r.deliveryMode === "OFFLINE")
    .reduce((sum, r) => sum + r.studentCount, 0)
  const onlineTotal = byKind
    .filter((r) => r.deliveryMode === "ONLINE")
    .reduce((sum, r) => sum + r.studentCount, 0)

  return (
    <div className="pb-8">
      <PageHeader title="Dashboard" description="Where things stand today." />

      {/*
        Money first. The question this business opens the app to answer is
        "what came in and what is still owed", so those three tiles lead and
        overdue is coloured to be the thing the eye lands on.
      */}
      <div className="grid gap-3 px-4 py-4 sm:grid-cols-3 sm:px-6">
        <StatTile
          label="Collected this month"
          value={formatINRShort(collected)}
          icon={<IndianRupee className="size-3.5" />}
        />
        <StatTile label="Outstanding" value={formatINRShort(outstanding)} />
        <StatTile
          label="Overdue"
          value={overdue}
          tone={overdue > 0 ? "overdue" : undefined}
          hint={overdue > 0 ? "Needs chasing" : "All clear"}
          icon={overdue > 0 ? <AlertTriangle className="size-3.5" /> : undefined}
        />
      </div>

      <div className="grid gap-3 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <StatTile
          label="Total contacts"
          value={contacts}
          icon={<Users className="size-3.5" />}
        />
        <StatTile label="Active students" value={students} />
        <StatTile label="Active batches" value={batches} />
        <StatTile
          label="Sessions this week"
          value={upcomingCount}
          icon={<CalendarDays className="size-3.5" />}
        />
      </div>

      <div className="mt-6 grid gap-6 px-4 sm:px-6 lg:grid-cols-2">
        {/*
          The split that justifies storing type and delivery mode as two
          independent columns: it answers "how many on mentorship" and "how
          many attend offline" from the same rows, with no string parsing.
        */}
        <section>
          <SectionHeading
            action={
              <Link
                href="/programs"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Programs <ArrowRight className="size-3" />
              </Link>
            }
          >
            Active students by program
          </SectionHeading>

          {byKind.length === 0 ? (
            <EmptyState
              title="No active enrollments"
              description="Enroll someone to see the split by program and delivery mode."
            />
          ) : (
            <div className="overflow-hidden rounded-xl border bg-card">
              <ul className="divide-y">
                {byKind.map((row) => (
                  <li
                    key={`${row.type}-${row.deliveryMode}`}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm"
                  >
                    {row.deliveryMode === "ONLINE" ? (
                      <Video className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    ) : (
                      <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1 truncate">
                      {programKindLabelOf(row.type, row.deliveryMode)}
                    </span>
                    <span className="font-medium tabular-nums">{row.studentCount}</span>
                  </li>
                ))}
              </ul>

              <div className="flex divide-x border-t bg-muted/40 text-sm">
                <p className="flex-1 px-4 py-2.5">
                  <span className="text-muted-foreground">Online </span>
                  <span className="font-medium tabular-nums">{onlineTotal}</span>
                </p>
                <p className="flex-1 px-4 py-2.5">
                  <span className="text-muted-foreground">Offline </span>
                  <span className="font-medium tabular-nums">{offlineTotal}</span>
                </p>
              </div>
            </div>
          )}
        </section>

        <section>
          <SectionHeading
            action={
              <Link
                href="/sessions"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                All sessions <ArrowRight className="size-3" />
              </Link>
            }
          >
            Next 7 days
          </SectionHeading>

          {upcoming.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="size-5" />}
              title="Nothing scheduled this week"
              description="Sessions are added inside a batch."
            />
          ) : (
            <ul className="divide-y overflow-hidden rounded-xl border bg-card">
              {upcoming.map((session) => (
                <li key={session.id}>
                  <Link
                    href={`/attendance/${session.id}`}
                    className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-accent/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{session.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {session.programName} ·{" "}
                        {programKindLabelOf(session.programType, session.deliveryMode)}
                        {session.venueName ? ` · ${session.venueName}` : ""}
                      </p>
                    </div>
                    <StatusPill tone="info">
                      {formatIST(session.scheduledAt, "d MMM, h:mm a")}
                    </StatusPill>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {overdue > 0 ? (
        <div className="mt-6 px-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-overdue/30 bg-overdue-muted px-4 py-3">
            <AlertTriangle className="size-4 shrink-0 text-overdue" aria-hidden />
            <p className="min-w-0 flex-1 text-sm text-overdue-foreground">
              <span className="font-medium">{overdue}</span> enrollment
              {overdue === 1 ? " has" : "s have"} a payment past its due date.
            </p>
            <Button size="sm" variant="outline" render={<Link href="/fees" />}>
              View overdue
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
