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
        className="max-w-2xl space-y-5 px-4 py-4 sm:px-6"
      >
        {savedCount > 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-paid/30 bg-paid-muted/30 px-4 py-3 text-sm text-paid-foreground">
            <span className="flex size-2 rounded-full bg-paid" />
            <span className="font-medium">{savedCount}</span> record{savedCount === 1 ? "" : "s"} saved in this session.
          </div>
        ) : null}

        {/* ---------------- 1. Program ---------------- */}
        <div className="rounded-xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-border/60 pb-3">
            <span className="flex size-5.5 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">1</span>
            <h3 className="text-sm font-semibold text-foreground">Program Selection</h3>
          </div>
          <FormField
            control={form.control}
            name="programKind"
            render={({ field }) => (
              <FormItem>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {RECORD_PROGRAM_KINDS.map((kind) => {
                    const selected = field.value === kind.value
                    return (
                      <label
                        key={kind.value}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 text-sm font-medium transition-all",
                          selected
                            ? "border-primary bg-primary/10 text-primary shadow-xs"
                            : "border-border/80 bg-secondary/30 hover:border-border hover:bg-secondary/60 active:scale-[0.99]"
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
                            "flex size-4.5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                            selected ? "border-primary bg-primary" : "border-muted-foreground/40"
                          )}
                        >
                          {selected ? <span className="size-1.5 rounded-full bg-primary-foreground" /> : null}
                        </span>
                        <span>{kind.label}</span>
                      </label>
                    )
                  })}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* ---------------- 2. Student ---------------- */}
        <div className="rounded-xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-border/60 pb-3">
            <span className="flex size-5.5 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">2</span>
            <h3 className="text-sm font-semibold text-foreground">Student Details</h3>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full name</FormLabel>
                  <FormControl>
                    <Input placeholder="Ravi Kumar" autoComplete="name" {...field} />
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
                      autoComplete="tel"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    An existing number links to that student.
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
                    Email <span className="text-muted-foreground font-normal">optional</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      inputMode="email"
                      autoComplete="email"
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
                    City <span className="text-muted-foreground font-normal">optional</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Pune" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* ---------------- 3. Enrollment ---------------- */}
        <div className="rounded-xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-border/60 pb-3">
            <span className="flex size-5.5 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">3</span>
            <h3 className="text-sm font-semibold text-foreground">Enrollment &amp; Batch</h3>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="enrolledOn"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date of enrollment</FormLabel>
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
                    Batch label <span className="text-muted-foreground font-normal">optional</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      list="batch-labels"
                      placeholder="B1"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
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
        </div>

        {/* ---------------- 4. Fees ---------------- */}
        <div className="rounded-xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-border/60 pb-3">
            <span className="flex size-5.5 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">4</span>
            <h3 className="text-sm font-semibold text-foreground">Fees &amp; Initial Payment</h3>
          </div>

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
                  <FormLabel>Fees paid now (₹)</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="decimal"
                      placeholder="0"
                      {...field}
                      value={String(field.value ?? "")}
                    />
                  </FormControl>
                  <FormDescription>Leave blank if unpaid.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Outstanding, live derived tile */}
          {money ? (
            <div className="flex items-center justify-between rounded-xl border border-border/70 bg-secondary/40 p-4 shadow-xs">
              <div>
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Outstanding</span>
                <p className="text-xs text-muted-foreground">Computed live from Total − Paid</p>
              </div>
              <span
                className={cn(
                  "rounded-lg px-3 py-1 text-lg font-bold tabular-nums",
                  money.outstanding > 0
                    ? "border border-overdue/30 bg-overdue-muted/40 text-overdue"
                    : money.outstanding === 0
                      ? "border border-paid/30 bg-paid-muted/40 text-paid"
                      : "text-foreground"
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
                        className="h-10 w-full rounded-lg border border-border/80 bg-card px-3 text-sm text-foreground outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20"
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
                      Payment reference <span className="text-muted-foreground font-normal">optional</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="UPI txn id / cheque no"
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
                  Notes <span className="text-muted-foreground font-normal">optional</span>
                </FormLabel>
                <FormControl>
                  <Textarea rows={2} placeholder="Any notes on installments or student requests" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex flex-col gap-2.5 pt-2 sm:flex-row">
          <Button
            type="submit"
            disabled={submitting}
            className="h-11 flex-1 bg-primary text-primary-foreground font-semibold px-6 hover:bg-primary/90 active:scale-[0.98] sm:flex-none"
          >
            {submitting ? "Saving…" : "Save record"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onSubmitAndAddAnother}
            disabled={submitting}
            className="h-11 active:scale-[0.98]"
          >
            Save &amp; add another
          </Button>
        </div>
      </form>
    </Form>
  )
}
