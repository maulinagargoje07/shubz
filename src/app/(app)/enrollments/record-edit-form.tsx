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
        className="max-w-2xl space-y-6 px-4 py-4 sm:px-6"
      >
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Program</legend>
          <FormField
            control={form.control}
            name="programKind"
            render={({ field }) => (
              <FormItem>
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
                    Email <span className="text-muted-foreground">optional</span>
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
                    City <span className="text-muted-foreground">optional</span>
                  </FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </fieldset>

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
                      className="h-10 w-full rounded-lg border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
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

        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          To change what has been paid, record or void a payment on the record
          page. The ledger is append-only so the history stays intact.
        </p>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Saving…" : "Save changes"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  )
}
