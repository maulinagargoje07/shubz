"use client"

import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { BATCH_STATUS_LABELS } from "@/lib/labels"
import { programKindLabel } from "@/lib/programs"
import {
  BATCH_STATUSES,
  batchFormSchema,
  type BatchFormParsed,
  type BatchFormValues,
} from "@/lib/validation/batch"
import { createBatch, updateBatch } from "@/server/batches/actions"
import type { Batch, DeliveryMode, ProgramType } from "@/db/schema"

export function BatchForm({
  program,
  batch,
}: {
  program: { id: string; name: string; type: ProgramType; deliveryMode: DeliveryMode }
  batch?: Batch
}) {
  const router = useRouter()
  const isEdit = Boolean(batch)

  /**
   * The parent program's delivery mode decides which half of this form exists.
   * An online batch asks for a meeting link; an offline one asks for a venue.
   * Never both — showing both would invite half-filled records where nobody
   * knows whether the class is on Zoom or in Kharadi.
   */
  const isOnline = program.deliveryMode === "ONLINE"

  const form = useForm<BatchFormValues, FormContext, BatchFormParsed>({
    resolver: zodResolver(batchFormSchema),
    defaultValues: {
      programId: program.id,
      name: batch?.name ?? "",
      code: batch?.code ?? "",
      startDate: batch?.startDate ?? "",
      endDate: batch?.endDate ?? "",
      timingText: batch?.timingText ?? "",
      mentorUserId: batch?.mentorUserId ?? null,
      capacity: batch?.capacity ?? "",
      meetingLink: batch?.meetingLink ?? "",
      venueName: batch?.venueName ?? "",
      venueAddress: batch?.venueAddress ?? "",
      seatCapacity: batch?.seatCapacity ?? "",
      status: batch?.status ?? "PLANNED",
      deliveryMode: program.deliveryMode,
    },
  })

  async function onSubmit() {
    const raw = form.getValues()
    const result = isEdit
      ? await updateBatch({ ...raw, id: batch!.id })
      : await createBatch(raw)

    if (!result.ok) {
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          form.setError(field as keyof BatchFormValues, { message })
        }
      }
      toast.error(result.error)
      return
    }

    toast.success(isEdit ? "Batch updated" : "Batch created")
    router.push(`/programs/${program.id}/batches/${result.data.id}`)
    router.refresh()
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-3xl space-y-6 px-4 py-4 sm:px-6">
        <Alert>
          <AlertDescription>
            {program.name} is <strong>{programKindLabel(program)}</strong>, so this batch
            needs {isOnline ? "a meeting link" : "a venue"}.
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Batch name</FormLabel>
                <FormControl>
                  <Input placeholder="Batch 7 — Sept 2026" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Code</FormLabel>
                <FormControl>
                  <Input
                    placeholder="SMC-B7"
                    {...field}
                    onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>End date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="timingText"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Timing</FormLabel>
                <FormControl>
                  <Input placeholder="Mon/Wed/Fri 7:30–9:00 PM" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="capacity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Capacity</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="Optional" {...field} value={String(field.value ?? "")} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* ---- The conditional half ---- */}
          {isOnline ? (
            <FormField
              control={form.control}
              name="meetingLink"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Meeting link</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://zoom.us/j/…"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormDescription>Where students join this batch online.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : (
            <>
              <FormField
                control={form.control}
                name="venueName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Venue</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="ShubzTrader Kharadi"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="seatCapacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Seats / desks</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="24"
                        {...field}
                        value={String(field.value ?? "")}
                      />
                    </FormControl>
                    <FormDescription>Physical desks available.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="venueAddress"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Venue address</FormLabel>
                    <FormControl>
                      <Textarea rows={2} {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "PLANNED")}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {BATCH_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {BATCH_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Create batch"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  )
}
