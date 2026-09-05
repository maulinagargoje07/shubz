"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ATTENDANCE_LABELS } from "@/lib/labels"
import { ATTENDANCE_STATUSES } from "@/lib/validation/attendance"
import { markAttendance } from "@/server/attendance/actions"
import type { AttendanceStatus, DeliveryMode } from "@/db/schema"

export type RegisterRow = {
  enrollmentId: string
  contactName: string
  contactPhone: string
  seatNumber: string | null
  status: AttendanceStatus | null
}

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
   * absentees rather than ticking twenty people one at a time — a room of
   * students is overwhelmingly present, and the fast path should match that.
   * Online starts from whatever was already marked.
   */
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>(() => {
    const initial: Record<string, AttendanceStatus> = {}
    for (const row of rows) {
      initial[row.enrollmentId] = row.status ?? (isOffline ? "PRESENT" : "ABSENT")
    }
    return initial
  })
  const [saving, setSaving] = useState(false)

  const presentCount = Object.values(marks).filter(
    (s) => s === "PRESENT" || s === "LATE"
  ).length

  function setAll(status: AttendanceStatus) {
    setMarks(Object.fromEntries(rows.map((r) => [r.enrollmentId, status])))
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

    toast.success(`Attendance saved for ${result.data.count} student${result.data.count === 1 ? "" : "s"}`)
    router.refresh()
  }

  if (rows.length === 0) {
    return (
      <p className="px-6 py-10 text-center text-sm text-muted-foreground">
        Nobody is enrolled in this batch yet.
      </p>
    )
  }

  return (
    <div className="px-6 pb-8">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setAll("PRESENT")}>
          Mark all present
        </Button>
        <Button variant="outline" size="sm" onClick={() => setAll("ABSENT")}>
          Mark all absent
        </Button>
        <Badge variant="secondary" className="ml-auto">
          {presentCount} of {rows.length} present
        </Badge>
      </div>

      <div className="divide-y rounded-lg border">
        {rows.map((row) => {
          const status = marks[row.enrollmentId] ?? "ABSENT"
          const isPresent = status === "PRESENT" || status === "LATE"

          return (
            <div key={row.enrollmentId} className="flex items-center gap-3 px-4 py-2.5">
              <Checkbox
                checked={isPresent}
                onCheckedChange={(checked) =>
                  setMarks((m) => ({
                    ...m,
                    [row.enrollmentId]: checked ? "PRESENT" : "ABSENT",
                  }))
                }
                aria-label={`${row.contactName} present`}
              />

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{row.contactName}</p>
                <p className="text-xs text-muted-foreground">
                  {row.seatNumber ? `Seat ${row.seatNumber} · ` : ""}
                  {row.contactPhone}
                </p>
              </div>

              {/* The checkbox covers present/absent; the select handles late and excused. */}
              <Select
                value={status}
                onValueChange={(v) =>
                  setMarks((m) => ({
                    ...m,
                    [row.enrollmentId]: (v as AttendanceStatus) ?? "ABSENT",
                  }))
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ATTENDANCE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {ATTENDANCE_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )
        })}
      </div>

      <Button className="mt-4" onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save attendance"}
      </Button>
    </div>
  )
}
