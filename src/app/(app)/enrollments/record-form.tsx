"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { cn } from "cn"

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
import { Textarea } from "@/components/ui/textarea"
import { todayIST } from "@/lib/fy"
import { formatINR, toPaise } from "@/lib/money"
import { PAYMENT_METHOD_LABELS } from "@/lib/labels"
import { PAYMENT_METHODS } from "@/lib/validation/payment"
import {
  RECORD_PROGRAM_KINDS,
  studentRecordSchema,
  type StudentRecordParsed,
  type StudentRecordValues,
} from "@/lib/validation/record"
import { createStudentRecord } from "@/server/records/actions"

export function StudentRecordForm({ batchLabels }: { batchLabels: string[] }) {
  const router = useRouter()
  const [savedCount, setSavedCount] = useState(0)

  const form = useForm<StudentRecordValues, FormContext, StudentRecordParsed>({
    resolver: zodResolver(studentRecordSchema),
    defaultValues: {
      fullName: "",
      phone: "",
      email: "",
      city: "",
      programKind: "MENTORSHIP__ONLINE",
      batchLabel: "",
      totalFeesRupees: "",
      feesPaidRupees: "",
      paymentMethod: "UPI",
      paymentReference: "",
      enrolledOn: todayIST(),
      notes: "",
    },
  })

  const totalFees = form.watch("totalFeesRupees")
  const feesPaid = form.watch("feesPaidRupees")

  /**
   * Outstanding is shown live rather than left to be discovered after saving.
   * It is derived here only for display — the stored truth comes from the
   * enrollment_balances view, computed from the ledger.
   */
  const money = useMemo(() => {
    const safe = (v: unknown) => {
      try {
        return toPaise((v as string) || 0)
      } catch {
        return null
      }
    }
    const total = safe(totalFees)
    const paid = safe(feesPaid) ?? 0
    if (total === null) return null
    return { total, paid, outstanding: total - paid }
  }, [totalFees, feesPaid])

  async function onSubmit() {
    const raw = form.getValues()
    const result = await createStudentRecord(raw)

    if (!result.ok) {
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          form.setError(field as keyof StudentRecordValues, { message })
        }
      }
      toast.error(result.error)
      return
    }

    toast.success(
      result.data.reusedContact
        ? "Enrollment added to the existing contact"
        : "Student record created",
      { description: result.data.receiptNo ? `Receipt ${result.data.receiptNo}` : undefined }
    )

    router.push(`/enrollments/${result.data.enrollmentId}`)
    router.refresh()
  }

  /**
   * Saving and immediately clearing for the next entry. Records are usually
   * added in a batch off a sheet, and bouncing to the detail page after each
   * one would mean navigating back twenty times.
   */
  async function onSubmitAndAddAnother() {
    const valid = await form.trigger()
    if (!valid) return

    const raw = form.getValues()
    const result = await createStudentRecord(raw)

    if (!result.ok) {
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          form.setError(field as keyof StudentRecordValues, { message })
        }
      }
      toast.error(result.error)
      return
    }

    setSavedCount((n) => n + 1)
    toast.success(`Saved ${raw.fullName}`, {
      description: result.data.receiptNo ? `Receipt ${result.data.receiptNo}` : undefined,
    })

    // Keep the settings that stay the same down a sheet of entries.
    form.reset({
      ...form.getValues(),
      fullName: "",
      phone: "",
      email: "",
      city: "",
      totalFeesRupees: "",
      feesPaidRupees: "",
      paymentReference: "",
      notes: "",
    })
    router.refresh()
  }

  const submitting = form.formState.isSubmitting

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="max-w-2xl space-y-6 px-4 py-4 sm:px-6"
      >
        {savedCount > 0 ? (
          <p className="rounded-lg bg-paid-muted px-3 py-2 text-sm text-paid-foreground">
            {savedCount} record{savedCount === 1 ? "" : "s"} saved in this session.
          </p>
        ) : null}

        {/* ---------------- Program ---------------- */}
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Program</legend>
          <FormField
            control={form.control}
            name="programKind"
            render={({ field }) => (
              <FormItem>
                {/*
                  Four cards rather than a dropdown: there are only four, the
                  choice drives everything else on the form, and a visible
                  radio group is one tap on a phone instead of two.
                */}
                <div className="grid gap-2 sm:grid-cols-2">
                  {RECORD_PROGRAM_KINDS.map((kind) => {
                    const selected = field.value === kind.value
                    return (
                      <label
                        key={kind.value}
                        className={cn(
                          "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                          selected
                            ? "border-primary bg-accent text-accent-foreground"
                            : "hover:bg-accent/40"
                        )}
                      >
                        <input
                          type="radio"
                          className="sr-only"
                          name={field.name}
                          value={kind.value}
                          checked={selected}
                          onChange={() => field.onChange(kind.value)}
                        />
                        <span
                          aria-hidden
                          className={cn(
                            "size-4 shrink-0 rounded-full border-2 transition-colors",
                            selected ? "border-primary bg-primary" : "border-muted-foreground/40"
                          )}
                        />
                        {kind.label}
                      </label>
                    )
                  })}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </fieldset>

        {/* ---------------- Student ---------------- */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-medium">Student</legend>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full name</FormLabel>
                  <FormControl>
                    <Input placeholder="Ravi Kumar" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      inputMode="tel"
                      placeholder="9876543210"
                      autoComplete="off"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    An existing number adds the enrollment to that student.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Email <span className="text-muted-foreground">optional</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      inputMode="email"
                      autoCapitalize="none"
                      autoCorrect="off"
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
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    City <span className="text-muted-foreground">optional</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Pune" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </fieldset>

        {/* ---------------- Enrollment ---------------- */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-medium">Enrollment</legend>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="enrolledOn"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="batchLabel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Batch <span className="text-muted-foreground">optional</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      list="batch-labels"
                      placeholder="B1"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  {/* Suggests batches already in use without forcing a choice. */}
                  <datalist id="batch-labels">
                    {batchLabels.map((label) => (
                      <option key={label} value={label} />
                    ))}
                  </datalist>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </fieldset>

        {/* ---------------- Fees ---------------- */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-medium">Fees</legend>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="totalFeesRupees"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Total fees (₹)</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="decimal"
                      placeholder="45000"
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
              name="feesPaidRupees"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fees paid (₹)</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="decimal"
                      placeholder="0"
                      {...field}
                      value={String(field.value ?? "")}
                    />
                  </FormControl>
                  <FormDescription>Leave blank if nothing is paid yet.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Outstanding, live. Derived here for display; the stored truth is
              the enrollment_balances view. */}
          {money ? (
            <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
              <span className="text-sm text-muted-foreground">Outstanding</span>
              <span
                className={cn(
                  "text-lg font-semibold tabular-nums",
                  money.outstanding > 0
                    ? "text-overdue"
                    : money.outstanding === 0
                      ? "text-paid"
                      : ""
                )}
              >
                {formatINR(Math.max(money.outstanding, 0))}
              </span>
            </div>
          ) : null}

          {money && money.paid > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment method</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className="h-10 w-full rounded-lg border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                      >
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m} value={m}>
                            {PAYMENT_METHOD_LABELS[m]}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="paymentReference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Reference <span className="text-muted-foreground">optional</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="UPI txn id"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          ) : null}

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Notes <span className="text-muted-foreground">optional</span>
                </FormLabel>
                <FormControl>
                  <Textarea rows={2} {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </fieldset>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save record"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onSubmitAndAddAnother}
            disabled={submitting}
          >
            Save &amp; add another
          </Button>
        </div>
      </form>
    </Form>
  )
}
