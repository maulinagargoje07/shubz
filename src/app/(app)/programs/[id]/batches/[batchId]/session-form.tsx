"use client"

import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  type FormContext,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SESSION_STATUS_LABELS } from "@/lib/labels"
import {
  SESSION_STATUSES,
  sessionFormSchema,
  type SessionFormParsed,
  type SessionFormValues,
} from "@/lib/validation/session"
import { createSession, updateSession } from "@/server/sessions/actions"
import type { ClassSession, DeliveryMode } from "@/db/schema"

/** A stored instant rendered as IST wall-clock text for datetime-local. */
function toISTLocalInput(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00"
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}`
}

export function SessionFormDialog({
  batchId,
  deliveryMode,
  nextSeq,
  session,
  trigger,
}: {
  batchId: string
  deliveryMode: DeliveryMode
  nextSeq: number
  session?: ClassSession
  trigger: React.ReactElement
}) {
  const router = useRouter()
  const isEdit = Boolean(session)
  const isOnline = deliveryMode === "ONLINE"

  const form = useForm<SessionFormValues, FormContext, SessionFormParsed>({
    resolver: zodResolver(sessionFormSchema),
    defaultValues: {
      batchId,
      seq: session?.seq ?? nextSeq,
      title: session?.title ?? "",
      scheduledAtLocal: session ? toISTLocalInput(session.scheduledAt) : "",
      durationMinutes: session?.durationMinutes ?? 90,
      meetingLink: session?.meetingLink ?? "",
      roomOrDesk: session?.roomOrDesk ?? "",
      recordingLink: session?.recordingLink ?? "",
      status: session?.status ?? "SCHEDULED",
    },
  })

  async function onSubmit() {
    const raw = form.getValues()
    const result = isEdit
      ? await updateSession({ ...raw, id: session!.id })
      : await createSession(raw)

    if (!result.ok) {
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          form.setError(field as keyof SessionFormValues, { message })
        }
      }
      toast.error(result.error)
      return
    }

    toast.success(isEdit ? "Session updated" : "Session added")
    router.refresh()
  }

  return (
    <Dialog>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit session" : "Add session"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="seq"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>#</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} value={String(field.value ?? "")} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Market structure basics" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="scheduledAtLocal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date &amp; time (IST)</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
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
                      <Input type="number" {...field} value={String(field.value ?? "")} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Online sessions get a link; offline ones get a room. */}
            {isOnline ? (
              <FormField
                control={form.control}
                name="meetingLink"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meeting link</FormLabel>
                    <FormControl>
                      <Input placeholder="Defaults to the batch link" {...field} value={field.value ?? ""} />
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
                    <FormLabel>Room / desk block</FormLabel>
                    <FormControl>
                      <Input placeholder="Main floor" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="recordingLink"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recording</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "SCHEDULED")}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SESSION_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {SESSION_STATUS_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Add session"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
