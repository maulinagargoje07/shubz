"use client"

import { useMemo } from "react"
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
import { formatDate, todayIST } from "@/lib/fy"
import { formatINR, toPaise, toRupees } from "@/lib/money"
import { ENROLLMENT_STATUS_LABELS } from "@/lib/labels"
import { billingCycleLabel, programKindLabel } from "@/lib/programs"
import { planSchedule } from "@/lib/billing"
import {
  ENROLLMENT_STATUSES,
  enrollmentFormSchema,
  type EnrollmentFormParsed,
  type EnrollmentFormValues,
} from "@/lib/validation/enrollment"
import { BILLING_CYCLE_VALUES } from "@/lib/validation/program"
import { createEnrollment, updateEnrollment } from "@/server/enrollments/actions"
import type { BillingCycle, DeliveryMode, ProgramType } from "@/db/schema"

export type PickerProgram = {
  id: string
  name: string
  type: ProgramType
  deliveryMode: DeliveryMode
  defaultFeePaise: number
  defaultBillingType: "ONE_TIME" | "RECURRING"
  defaultBillingCycle: BillingCycle | null
}

export type PickerBatch = {
  id: string
  name: string
  code: string
  programId: string
  seatCapacity: number | null
}

export type PickerContact = { id: string; fullName: string; phoneE164: string }

export function EnrollmentForm({
  contacts,
  programs,
  batches,
  takenSeats = {},
  enrollment,
}: {
  contacts: PickerContact[]
  programs: PickerProgram[]
  batches: PickerBatch[]
  takenSeats?: Record<string, string[]>
  enrollment?: {
    id: string
    contactId: string
    programId: string
    batchId: string | null
    status: (typeof ENROLLMENT_STATUSES)[number]
    enrolledOn: string
    startDate: string | null
    endDate: string | null
    feeTotalPaise: number
    discountPaise: number
    billingType: "ONE_TIME" | "RECURRING"
    billingCycle: BillingCycle | null
    seatNumber: string | null
    notes: string | null
  }
}) {
  const router = useRouter()
  const isEdit = Boolean(enrollment)

  const form = useForm<EnrollmentFormValues, FormContext, EnrollmentFormParsed>({
    resolver: zodResolver(enrollmentFormSchema),
    defaultValues: {
      contactId: enrollment?.contactId ?? "",
      programId: enrollment?.programId ?? "",
      batchId: enrollment?.batchId ?? null,
      status: enrollment?.status ?? "ACTIVE",
      enrolledOn: enrollment?.enrolledOn ?? todayIST(),
      startDate: enrollment?.startDate ?? "",
      endDate: enrollment?.endDate ?? "",
      feeRupees: enrollment ? String(toRupees(enrollment.feeTotalPaise)) : "",
      discountRupees: enrollment ? String(toRupees(enrollment.discountPaise)) : "0",
      billingType: enrollment?.billingType ?? "ONE_TIME",
      billingCycle: enrollment?.billingCycle ?? null,
      installments: 1,
      seatNumber: enrollment?.seatNumber ?? "",
      assignedMentorUserId: null,
      notes: enrollment?.notes ?? "",
    },
  })

  const programId = form.watch("programId")
  const batchId = form.watch("batchId")
  const billingType = form.watch("billingType")
  const billingCycle = form.watch("billingCycle")
  const feeRupees = form.watch("feeRupees")
  const discountRupees = form.watch("discountRupees")
  const installments = form.watch("installments")
  const enrolledOn = form.watch("enrolledOn")
  const startDate = form.watch("startDate")

  const program = programs.find((p) => p.id === programId)
  const programBatches = useMemo(
    () => batches.filter((b) => b.programId === programId),
    [batches, programId]
  )

  // A seat is a physical desk, so it only exists for offline programs.
  const showSeat = program?.deliveryMode === "OFFLINE"
  const seatsTaken = batchId ? (takenSeats[batchId] ?? []) : []
  const selectedBatch = programBatches.find((b) => b.id === batchId)

  /** Choosing a program pre-fills its fee and billing defaults. */
  function onProgramChange(value: string | null) {
    if (!value) return
    form.setValue("programId", value, { shouldDirty: true })
    form.setValue("batchId", null)

    const next = programs.find((p) => p.id === value)
    if (!next) return

    form.setValue("billingType", next.defaultBillingType)
    form.setValue("billingCycle", next.defaultBillingCycle)
    if (next.defaultFeePaise > 0 && !form.getValues("feeRupees")) {
      form.setValue("feeRupees", String(toRupees(next.defaultFeePaise)))
    }
  }

  /**
   * Live preview of the schedule this enrollment will create, computed with
   * the same planSchedule() the server uses — so what is shown is what gets
   * written, not an approximation.
   */
  const preview = useMemo(() => {
    try {
      const fee = toPaise(feeRupees || 0)
      const discount = toPaise(discountRupees || 0)
      if (fee === 0) return null
      if (discount > fee) return null
      if (billingType === "RECURRING" && !billingCycle) return null

      const rows = planSchedule({
        billingType,
        billingCycle: billingCycle ?? null,
        feeTotalPaise: fee,
        discountPaise: discount,
        startDate: startDate || enrolledOn || todayIST(),
        installments: Number(installments) || 1,
        cycles: billingType === "RECURRING" ? 3 : undefined,
      })

      return {
        net: billingType === "RECURRING" ? fee - discount : fee - discount,
        rows,
      }
    } catch {
      return null
    }
  }, [feeRupees, discountRupees, billingType, billingCycle, installments, startDate, enrolledOn])

  async function onSubmit() {
    const raw = form.getValues()
    const result = isEdit
      ? await updateEnrollment({ ...raw, id: enrollment!.id })
      : await createEnrollment(raw)

    if (!result.ok) {
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          form.setError(field as keyof EnrollmentFormValues, { message })
        }
      }
      toast.error(result.error)
      return
    }

    toast.success(isEdit ? "Enrollment updated" : "Enrolled")
    router.push(`/enrollments/${result.data.id}`)
    router.refresh()
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-3xl space-y-6 px-4 py-4 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="contactId"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Student</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={(v) => field.onChange(v ?? "")}
                  disabled={isEdit}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a contact" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.fullName} · {c.phoneE164}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="programId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Program</FormLabel>
                <Select value={field.value} onValueChange={onProgramChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a program" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {programs.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — {programKindLabel(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="batchId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Batch</FormLabel>
                <Select
                  value={field.value ?? "__none"}
                  onValueChange={(v) => field.onChange(v === "__none" ? null : v)}
                  disabled={!programId}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {/* Trading Floor memberships often run without a batch. */}
                    <SelectItem value="__none">No batch</SelectItem>
                    {programBatches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="enrolledOn"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Enrolled on</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
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
                <FormLabel>Billing starts</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormDescription>Defaults to the enrolment date.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="feeRupees"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fee (₹)</FormLabel>
                <FormControl>
                  <Input
                    inputMode="decimal"
                    placeholder="45000"
                    {...field}
                    value={String(field.value ?? "")}
                  />
                </FormControl>
                <FormDescription>
                  {billingType === "RECURRING"
                    ? "Per billing cycle, not a contract total."
                    : "Total fee before discount."}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="discountRupees"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Discount (₹)</FormLabel>
                <FormControl>
                  <Input
                    inputMode="decimal"
                    placeholder="0"
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
            name="billingType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Billing</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={(v) => {
                    field.onChange(v ?? "ONE_TIME")
                    if (v !== "RECURRING") form.setValue("billingCycle", null)
                    else if (!form.getValues("billingCycle"))
                      form.setValue("billingCycle", "MONTHLY")
                  }}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="ONE_TIME">One-time</SelectItem>
                    <SelectItem value="RECURRING">Recurring</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {billingType === "RECURRING" ? (
            <FormField
              control={form.control}
              name="billingCycle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cycle</FormLabel>
                  <Select
                    value={field.value ?? "MONTHLY"}
                    onValueChange={(v) => field.onChange(v ?? "MONTHLY")}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {BILLING_CYCLE_VALUES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {billingCycleLabel(c)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : (
            <FormField
              control={form.control}
              name="installments"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Installments</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={36}
                      {...field}
                      value={String(field.value ?? 1)}
                    />
                  </FormControl>
                  <FormDescription>1 means pay in full.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Seat allocation exists only for offline programs. */}
          {showSeat ? (
            <FormField
              control={form.control}
              name="seatNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Seat / desk</FormLabel>
                  <FormControl>
                    <Input placeholder="D-12" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormDescription>
                    {selectedBatch?.seatCapacity
                      ? `${seatsTaken.length} of ${selectedBatch.seatCapacity} taken`
                      : "Optional desk allocation."}
                    {seatsTaken.length > 0 ? ` Taken: ${seatsTaken.join(", ")}` : ""}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "ACTIVE")}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {ENROLLMENT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {ENROLLMENT_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea rows={2} {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {preview && !isEdit ? (
          <Alert>
            <AlertDescription>
              <p className="mb-2 font-medium text-foreground">
                {billingType === "RECURRING"
                  ? `${formatINR(preview.net)} every ${billingCycleLabel(billingCycle ?? "MONTHLY").toLowerCase()}`
                  : `Net payable ${formatINR(preview.net)}`}
              </p>
              <ul className="space-y-0.5 text-xs">
                {preview.rows.map((row) => (
                  <li key={row.seq} className="flex justify-between gap-4">
                    <span>
                      {billingType === "RECURRING" ? "Cycle" : "Installment"} {row.seq} ·{" "}
                      {formatDate(row.dueDate)}
                    </span>
                    <span className="tabular-nums">{formatINR(row.amountPaise)}</span>
                  </li>
                ))}
                {billingType === "RECURRING" ? (
                  <li className="pt-1 text-muted-foreground">
                    …cycles continue and roll forward as they are paid.
                  </li>
                ) : null}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Enroll"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  )
}
