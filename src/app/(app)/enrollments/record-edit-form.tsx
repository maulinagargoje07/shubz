"use client"

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
import { formatINR, toRupees } from "@/lib/money"
import { ENROLLMENT_STATUS_LABELS } from "@/lib/labels"
import { ENROLLMENT_STATUSES } from "@/lib/validation/enrollment"
import {
  RECORD_PROGRAM_KINDS,
  studentRecordEditSchema,
  type RecordProgramKind,
  type StudentRecordEditParsed,
  type StudentRecordEditValues,
} from "@/lib/validation/record"
import { updateStudentRecord } from "@/server/records/actions"

export function StudentRecordEditForm({
  record,
  batchLabels,
  paidPaise,
}: {
  record: {
    id: string
    fullName: string
    phone: string
    email: string | null
    city: string | null
    programKind: RecordProgramKind
    batchLabel: string | null
    totalFeesPaise: number
    enrolledOn: string
    status: (typeof ENROLLMENT_STATUSES)[number]
    notes: string | null
  }
  batchLabels: string[]
  paidPaise: number
}) {
  const router = useRouter()

  const form = useForm<StudentRecordEditValues, FormContext, StudentRecordEditParsed>({
    resolver: zodResolver(studentRecordEditSchema),
    defaultValues: {
      id: record.id,
      fullName: record.fullName,
      phone: record.phone,
      email: record.email ?? "",
      city: record.city ?? "",
      programKind: record.programKind,
      batchLabel: record.batchLabel ?? "",
      totalFeesRupees: String(toRupees(record.totalFeesPaise)),
      enrolledOn: record.enrolledOn,
      status: record.status,
      notes: record.notes ?? "",
    },
  })

  async function onSubmit() {
    const result = await updateStudentRecord(form.getValues())

    if (!result.ok) {
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          form.setError(field as keyof StudentRecordEditValues, { message })
        }
      }
      toast.error(result.error)
      return
    }

    toast.success("Record updated")
    router.push(`/enrollments/${record.id}`)
    router.refresh()
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="max-w-2xl space-y-5 px-4 py-4 sm:px-6"
      >
        {/* ---------------- 1. Program ---------------- */}
        <div className="rounded-xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-border/60 pb-3">
            <span className="flex size-5.5 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">1</span>
            <h3 className="text-sm font-semibold text-foreground">Program</h3>
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
                    <Input {...field} />
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
                    <Input type="tel" inputMode="tel" {...field} />
                  </FormControl>
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
                      autoCapitalize="none"
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
                    <Input {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* ---------------- 3. Enrollment & Fees ---------------- */}
        <div className="rounded-xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-border/60 pb-3">
            <span className="flex size-5.5 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">3</span>
            <h3 className="text-sm font-semibold text-foreground">Enrollment &amp; Fees</h3>
          </div>
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
                    Batch <span className="text-muted-foreground font-normal">optional</span>
                  </FormLabel>
                  <FormControl>
                    <Input list="batch-labels" {...field} value={field.value ?? ""} />
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
            <FormField
              control={form.control}
              name="totalFeesRupees"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Total fees (₹)</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="decimal"
                      {...field}
                      value={String(field.value ?? "")}
                    />
                  </FormControl>
                  <FormDescription>
                    {formatINR(paidPaise)} already paid. Outstanding recalculates on save.
                  </FormDescription>
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
                  <FormControl>
                    <select
                      {...field}
                      className="h-10 w-full rounded-lg border border-border/80 bg-card px-3 text-sm text-foreground outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20"
                    >
                      {ENROLLMENT_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {ENROLLMENT_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Notes <span className="text-muted-foreground font-normal">optional</span>
                </FormLabel>
                <FormControl>
                  <Textarea rows={2} {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="rounded-xl border border-border/60 bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
          To change what has been paid, record or void a payment on the record
          page. The ledger is append-only so the history stays intact.
        </div>

        <div className="flex flex-col gap-2.5 pt-2 sm:flex-row">
          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="h-11 flex-1 bg-primary text-primary-foreground font-semibold px-6 hover:bg-primary/90 active:scale-[0.98] sm:flex-none"
          >
            {form.formState.isSubmitting ? "Saving…" : "Save changes"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()} className="h-11 active:scale-[0.98]">
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  )
}
