import Link from "next/link"
import { ClipboardCheck } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { EmptyState, StatusPill } from "@/components/ui/status"
import { formatIST } from "@/lib/fy"

type SessionCell = {
  id: string
  seq: number
  title: string
  scheduledAt: Date
  status: string
  held: boolean
  markedCount: number
}

type StudentRow = {
  enrollmentId: string
  contactId: string
  name: string
  seatNumber: string | null
  marks: Record<string, string>
  attended: number
  eligible: number
  percent: number | null
}

/** One character per session, so a whole term fits on a phone screen. */
const MARK_GLYPH: Record<string, string> = {
  PRESENT: "P",
  LATE: "L",
  EXCUSED: "E",
  ABSENT: "A",
}

function markClasses(mark: string | undefined, held: boolean): string {
  if (!held) return "border-border/50 bg-muted/40 text-muted-foreground/50"
  switch (mark) {
    case "PRESENT":
      return "border-paid/40 bg-paid-muted text-paid-foreground"
    case "LATE":
      return "border-pending/40 bg-pending-muted text-pending-foreground"
    case "EXCUSED":
      return "border-border/60 bg-muted text-muted-foreground"
    case "ABSENT":
      return "border-overdue/40 bg-overdue-muted text-overdue-foreground"
    default:
      // Held but nobody marked it — deliberately distinct from "absent", since
      // "we did not take the register" is not the same as "they did not come".
      return "border-dashed border-border/70 bg-transparent text-muted-foreground/60"
  }
}

/**
 * The whole batch's attendance at a glance.
 *
 * Attendance could only be viewed one session at a time, which answers "who
 * came today" but never "who keeps missing classes" — the question that
 * actually needs acting on, and the one a parent or a mentor asks. Sessions
 * run across, students run down, and the percentage column is the same formula
 * the contact page uses so the two never disagree.
 */
export function BatchAttendance({
  sessions,
  students,
  heldCount,
}: {
  sessions: SessionCell[]
  students: StudentRow[]
  heldCount: number
}) {
  if (students.length === 0) {
    return (
      <EmptyState
        title="Nobody enrolled yet"
        description="Enroll students into this batch and their attendance will appear here."
      />
    )
  }

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardCheck className="size-5" />}
        title="No sessions scheduled"
        description="Schedule the batch's classes and registers will appear here."
      />
    )
  }

  const unmarked = sessions.filter((s) => s.held && s.markedCount === 0)

  return (
    <div className="space-y-3">
      {unmarked.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-pending/30 bg-pending-muted px-3 py-2 text-sm text-pending-foreground">
          <span className="min-w-0 flex-1">
            {unmarked.length} session{unmarked.length === 1 ? " has" : "s have"} been held
            without a register.
          </span>
          <Button
            size="sm"
            variant="outline"
            render={<Link href={`/attendance/${unmarked[0].id}`} />}
          >
            Mark {unmarked[0].title}
          </Button>
        </div>
      ) : null}

      {/*
        Scrolls inside its own container so a long run of sessions never makes
        the page itself scroll sideways.
      */}
      <div className="scroll-x rounded-xl border border-border/80 bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/80">
              <th
                scope="col"
                className="sticky left-0 z-10 bg-card px-4 py-2.5 text-left text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground/80"
              >
                Student
              </th>
              {sessions.map((session) => (
                <th
                  key={session.id}
                  scope="col"
                  className="px-1 py-2.5 text-center text-[0.6875rem] font-medium text-muted-foreground/80"
                  title={`${session.title} · ${formatIST(session.scheduledAt, "d MMM, h:mm a")}`}
                >
                  <Link
                    href={`/attendance/${session.id}`}
                    className="block hover:text-primary"
                  >
                    {session.seq}
                  </Link>
                </th>
              ))}
              <th
                scope="col"
                className="px-4 py-2.5 text-right text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground/80"
              >
                Rate
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {students.map((student) => (
              <tr key={student.enrollmentId} className="hover:bg-secondary/35">
                <td className="sticky left-0 z-10 bg-card px-4 py-2">
                  <Link
                    href={`/contacts/${student.contactId}`}
                    className="block min-w-0 hover:underline"
                  >
                    <span className="block truncate font-medium">{student.name}</span>
                    {student.seatNumber ? (
                      <span className="block text-xs text-muted-foreground">
                        Seat {student.seatNumber}
                      </span>
                    ) : null}
                  </Link>
                </td>

                {sessions.map((session) => {
                  const mark = student.marks[session.id]
                  return (
                    <td key={session.id} className="px-1 py-2 text-center">
                      <span
                        title={
                          !session.held
                            ? "Not held yet"
                            : mark
                              ? mark.charAt(0) + mark.slice(1).toLowerCase()
                              : "Register not taken"
                        }
                        className={cn(
                          "inline-flex size-6 items-center justify-center rounded border text-[0.625rem] font-semibold",
                          markClasses(mark, session.held)
                        )}
                      >
                        {session.held ? (MARK_GLYPH[mark ?? ""] ?? "·") : "·"}
                      </span>
                    </td>
                  )
                })}

                <td className="px-4 py-2 text-right">
                  {student.percent === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <StatusPill
                      tone={
                        student.percent >= 75
                          ? "paid"
                          : student.percent >= 50
                            ? "pending"
                            : "overdue"
                      }
                    >
                      {student.percent}%
                    </StatusPill>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-xs text-muted-foreground">
        <span>{heldCount} of {sessions.length} sessions held</span>
        <Legend glyph="P" label="Present" className="border-paid/40 bg-paid-muted text-paid-foreground" />
        <Legend glyph="L" label="Late" className="border-pending/40 bg-pending-muted text-pending-foreground" />
        <Legend glyph="A" label="Absent" className="border-overdue/40 bg-overdue-muted text-overdue-foreground" />
        <Legend glyph="E" label="Excused" className="border-border/60 bg-muted text-muted-foreground" />
        <Legend glyph="·" label="Not marked" className="border-dashed border-border/70 text-muted-foreground/60" />
      </div>
    </div>
  )
}

function Legend({
  glyph,
  label,
  className,
}: {
  glyph: string
  label: string
  className: string
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className={cn(
          "inline-flex size-5 items-center justify-center rounded border text-[0.625rem] font-semibold",
          className
        )}
      >
        {glyph}
      </span>
      {label}
    </span>
  )
}
