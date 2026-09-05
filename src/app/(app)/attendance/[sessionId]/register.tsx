"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, X } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { StatusPill, attendanceTone } from "@/components/ui/status"
import { ATTENDANCE_LABELS } from "@/lib/labels"
import { markAttendance } from "@/server/attendance/actions"
import type { AttendanceStatus, DeliveryMode } from "@/db/schema"

export type RegisterRow = {
  enrollmentId: string
  contactName: string
  contactPhone: string
  seatNumber: string | null
  status: AttendanceStatus | null
}

const CYCLE: AttendanceStatus[] = ["PRESENT", "LATE", "EXCUSED", "ABSENT"]

export function AttendanceRegister({
  sessionId,
  deliveryMode,
  rows,
}: {
  sessionId: string
  deliveryMode: DeliveryMode
  rows: RegisterRow[]
}) {
  const router = useRouter()
  const isOffline = deliveryMode === "OFFLINE"

  /**
   * Offline classes default everyone to PRESENT so the admin unchecks the few
   * absentees rather than tapping twenty names one at a time — a room of
   * students is overwhelmingly present, and the fast path should match that.
   * Online starts from whatever was already marked.
   */
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>(() =>
    Object.fromEntries(
      rows.map((row) => [row.enrollmentId, row.status ?? (isOffline ? "PRESENT" : "ABSENT")])
    )
  )
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const presentCount = useMemo(
    () => Object.values(marks).filter((s) => s === "PRESENT" || s === "LATE").length,
    [marks]
  )

  function setAll(status: AttendanceStatus) {
    setMarks(Object.fromEntries(rows.map((r) => [r.enrollmentId, status])))
    setDirty(true)
  }

  function toggle(enrollmentId: string) {
    setMarks((m) => ({
      ...m,
      [enrollmentId]: m[enrollmentId] === "ABSENT" ? "PRESENT" : "ABSENT",
    }))
    setDirty(true)
  }

  /** Long-press-free way to reach LATE and EXCUSED: cycle through the states. */
  function cycle(enrollmentId: string) {
    setMarks((m) => {
      const current = m[enrollmentId] ?? "ABSENT"
      const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length]
      return { ...m, [enrollmentId]: next }
    })
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    const result = await markAttendance({
      sessionId,
      entries: rows.map((r) => ({
        enrollmentId: r.enrollmentId,
        status: marks[r.enrollmentId] ?? "ABSENT",
      })),
    })
    setSaving(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }

    setDirty(false)
    toast.success(
      `Saved · ${presentCount} of ${rows.length} present`
    )
    router.refresh()
  }

  if (rows.length === 0) {
    return (
      <div className="mx-4 rounded-xl border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground sm:mx-6">
        Nobody is enrolled in this batch yet.
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setAll("PRESENT")}>
          <Check className="size-4" />
          All present
        </Button>
        <Button variant="outline" size="sm" onClick={() => setAll("ABSENT")}>
          <X className="size-4" />
          All absent
        </Button>
        <StatusPill tone="info" className="ml-auto">
          {presentCount} of {rows.length} present
        </StatusPill>
      </div>

      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {rows.map((row) => {
          const status = marks[row.enrollmentId] ?? "ABSENT"
          const isHere = status === "PRESENT" || status === "LATE"

          return (
            <li key={row.enrollmentId} className="flex items-center gap-3 px-3 py-2">
              {/*
                The name is the toggle. A whole-row target beats a 20px
                checkbox when marking a register standing up, and the tick
                itself is decoration rather than the thing to aim at.
              */}
              <button
                type="button"
                onClick={() => toggle(row.enrollmentId)}
                aria-pressed={isHere}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-accent/40"
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                    isHere
                      ? "border-paid bg-paid text-background"
                      : "border-border text-transparent"
                  )}
                >
                  <Check className="size-3.5" strokeWidth={3} />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {row.contactName}
                  </span>
                  {row.seatNumber ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      Seat {row.seatNumber}
                    </span>
                  ) : null}
                </span>
              </button>

              {/* Cycles PRESENT → LATE → EXCUSED → ABSENT for the exceptions. */}
              <button
                type="button"
                onClick={() => cycle(row.enrollmentId)}
                className="shrink-0"
                aria-label={`${row.contactName} is ${ATTENDANCE_LABELS[status]}. Change.`}
              >
                <StatusPill tone={attendanceTone(status)}>
                  {ATTENDANCE_LABELS[status]}
                </StatusPill>
              </button>
            </li>
          )
        })}
      </ul>

      {/*
        The save button sticks to the bottom on a phone so it is reachable
        without scrolling back through a long register, and sits above the tab
        bar rather than behind it.
      */}
      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-10 mt-4 lg:static lg:bottom-auto">
        <Button
          className="w-full shadow-lg font-semibold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] lg:w-auto lg:shadow-none"
          onClick={save}
          disabled={saving || !dirty}
        >
          {saving ? "Saving…" : dirty ? "Save attendance" : "Saved"}
        </Button>
      </div>
    </div>
  )
}
