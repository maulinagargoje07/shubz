"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { CalendarPlus } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  type FormContext,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { todayIST } from "@/lib/fy"
import {
  WEEKDAY_LABELS,
  formatPreviewDate,
  generateSeriesDates,
  renderTitle,
  type Weekday,
} from "@/lib/sessions/schedule"
import {
  sessionSeriesSchema,
  type SessionSeriesParsed,
  type SessionSeriesValues,
} from "@/lib/validation/session"
import { createSessionSeries } from "@/server/sessions/actions"

export type ScheduleBatchOption = {
  id: string
  name: string
  programName: string
  deliveryMode: "ONLINE" | "OFFLINE"
  endDate: string | null
  nextSeq: number
}

/**
 * Schedule a run of classes in one pass.
 *
 * The previous flow was one dialog per class, eight fields each, reachable
 * only from four levels down the navigation — twelve weekly sessions meant
 * twelve identical trips, with the sequence numbers kept straight by hand.
 * This asks the questions a timetable actually answers: which batch, what
 * time, which days, how many.
 */
export function ScheduleSessionsDialog({
  batches,
  defaultBatchId,
  trigger,
}: {
  batches: ScheduleBatchOption[]
  defaultBatchId?: string
  trigger?: React.ReactElement
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const form = useForm<SessionSeriesValues, FormContext, SessionSeriesParsed>({
    resolver: zodResolver(sessionSeriesSchema),
    defaultValues: {
      batchId: defaultBatchId ?? batches[0]?.id ?? "",
      titleTemplate: "Session {n}",
      startDate: todayIST(),
      time: "19:30",
      weekdays: [],
      count: 12,
      durationMinutes: 90,
      meetingLink: "",
      roomOrDesk: "",
    },
  })

  const batchId = form.watch("batchId")
  const startDate = form.watch("startDate")
  const watchedWeekdays = form.watch("weekdays")
  /*
   * `watch` hands back a fresh array each render, so using it directly as a
   * dependency recomputed the preview on every keystroke anywhere in the form.
   * Memoising on a stable serialisation keeps the identity steady.
   */
  const weekdayKey = (watchedWeekdays ?? []).join(",")
  const weekdays = useMemo(
    () => ((watchedWeekdays ?? []) as Weekday[]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [weekdayKey]
  )
  const count = form.watch("count")
  const titleTemplate = form.watch("titleTemplate")

  const batch = batches.find((b) => b.id === batchId)

  /**
   * The exact dates that will be created, computed with the same function the
   * server uses — so the preview is the outcome, not an approximation of it.
   */
  const preview = useMemo(() => {
    if (!startDate) return []
    return generateSeriesDates({
      startDate,
      weekdays,
      count: Number(count) || 1,
      endDate: batch?.endDate ?? null,
    })
  }, [startDate, weekdays, count, batch?.endDate])

  const cappedByBatch = preview.length < (Number(count) || 1)

  function toggleDay(day: Weekday) {
    const next = weekdays.includes(day)
      ? weekdays.filter((d) => d !== day)
      : [...weekdays, day]
    form.setValue("weekdays", next, { shouldDirty: true })
  }

  async function onSubmit() {
    const result = await createSessionSeries(form.getValues())

    if (!result.ok) {
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          form.setError(field as keyof SessionSeriesValues, { message })
        }
      }
      toast.error(result.error)
      return
    }

    toast.success(
      `${result.data.created} session${result.data.created === 1 ? "" : "s"} scheduled`,
      {
        description: `${formatPreviewDate(result.data.first)} – ${formatPreviewDate(
          result.data.last
        )}`,
      }
    )
    setOpen(false)
    router.refresh()
  }

  if (batches.length === 0) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button>
              <CalendarPlus className="size-4" />
              Schedule sessions
            </Button>
          )
        }
      />
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Schedule sessions</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {!defaultBatchId ? (
              <FormField
                control={form.control}
                name="batchId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Batch</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className="h-10 w-full rounded-lg border border-border/80 bg-card px-3 text-sm outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20"
                      >
                        {batches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} · {b.programName}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <FormField
              control={form.control}
              name="titleTemplate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Session {n}" {...field} />
                  </FormControl>
                  <FormDescription>
                    <code className="rounded bg-muted px-1">{"{n}"}</code> becomes the
                    session number — first one reads &ldquo;
                    {renderTitle(titleTemplate || "Session {n}", batch?.nextSeq ?? 1)}
                    &rdquo;
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Starting</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time (IST)</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div>
              <Label className="mb-1.5 block">Repeat on</Label>
              {/*
                Day chips rather than a multi-select: the whole pattern is
                visible at a glance, and each is a proper touch target.
              */}
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAY_LABELS.map((day) => {
                  const on = weekdays.includes(day.value)
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDay(day.value)}
                      aria-pressed={on}
                      className={cn(
                        "h-9 min-w-11 rounded-lg border px-2.5 text-sm font-medium transition-colors",
                        on
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border/80 text-muted-foreground hover:bg-secondary"
                      )}
                    >
                      {day.short}
                    </button>
                  )
                })}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {weekdays.length === 0
                  ? "None picked — repeats weekly on the start date's own day."
                  : `Every ${WEEKDAY_LABELS.filter((d) => weekdays.includes(d.value))
                      .map((d) => d.long)
                      .join(", ")}.`}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="count"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>How many</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        {...field}
                        value={String(field.value ?? "")}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="durationMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (min)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="numeric"
                        {...field}
                        value={String(field.value ?? "")}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Only the field that applies to how this batch is delivered. */}
            {batch?.deliveryMode === "ONLINE" ? (
              <FormField
                control={form.control}
                name="meetingLink"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Meeting link{" "}
                      <span className="text-muted-foreground">optional</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Used for every session in this run"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <FormField
                control={form.control}
                name="roomOrDesk"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Room <span className="text-muted-foreground">optional</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Used for every session in this run"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {preview.length > 0 ? (
              <div className="rounded-lg border border-border/80 bg-secondary/40 p-3">
                <p className="mb-1.5 text-xs font-medium">
                  {preview.length} session{preview.length === 1 ? "" : "s"} will be
                  created
                  {batch
                    ? `, numbered ${batch.nextSeq}–${batch.nextSeq + preview.length - 1}`
                    : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {preview.slice(0, 6).map(formatPreviewDate).join(" · ")}
                  {preview.length > 6
                    ? ` · … · ${formatPreviewDate(preview[preview.length - 1])}`
                    : ""}
                </p>
                {cappedByBatch ? (
                  <p className="mt-1.5 text-xs text-pending-foreground">
                    Stopped at the batch&apos;s end date.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="rounded-lg border border-overdue/30 bg-overdue-muted px-3 py-2 text-xs text-overdue-foreground">
                That pattern produces no dates.
              </p>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="submit"
                disabled={form.formState.isSubmitting || preview.length === 0}
              >
                {form.formState.isSubmitting
                  ? "Scheduling…"
                  : `Create ${preview.length} session${preview.length === 1 ? "" : "s"}`}
              </Button>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
