"use client"

import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

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
import { toRupees } from "@/lib/money"
import { PROGRAM_KINDS, findProgramKind, toProgramKind, billingCycleLabel } from "@/lib/programs"
import { PROGRAM_STATUS_LABELS } from "@/lib/labels"
import {
  BILLING_CYCLE_VALUES,
  PROGRAM_STATUSES,
  programFormSchema,
  type ProgramFormParsed,
  type ProgramFormValues,
} from "@/lib/validation/program"
import { createProgram, updateProgram } from "@/server/programs/actions"
import type { Program } from "@/db/schema"

export function ProgramForm({ program }: { program?: Program }) {
  const router = useRouter()
  const isEdit = Boolean(program)

  // Three generics: values in, context, values out. The schema transforms
  // rupee text into paise, so submit receives the parsed shape.
  const form = useForm<ProgramFormValues, FormContext, ProgramFormParsed>({
    resolver: zodResolver(programFormSchema),
    defaultValues: {
      name: program?.name ?? "",
      code: program?.code ?? "",
      kind: program ? toProgramKind(program.type, program.deliveryMode) : "MENTORSHIP__ONLINE",
      description: program?.description ?? "",
      defaultFeeRupees: program ? String(toRupees(program.defaultFeePaise)) : "",
      defaultDurationDays: program?.defaultDurationDays ?? "",
      defaultBillingType: program?.defaultBillingType ?? "ONE_TIME",
      defaultBillingCycle: program?.defaultBillingCycle ?? null,
      status: program?.status ?? "DRAFT",
    },
  })

  const billingType = form.watch("defaultBillingType")

  /**
   * Choosing a kind pre-fills the billing defaults for that kind. These are
   * suggestions, not constraints — every field stays editable afterwards, so a
   * one-off annual Trading Floor deal is still possible.
   */
  function onKindChange(value: string | null) {
    if (!value) return
    form.setValue("kind", value as ProgramFormValues["kind"], { shouldDirty: true })

    const kind = findProgramKind(value as ProgramFormValues["kind"])
    if (!kind) return

    form.setValue("defaultBillingType", kind.defaults.billingType)
    form.setValue("defaultBillingCycle", kind.defaults.billingCycle)
    if (kind.defaults.feePaise !== null) {
      form.setValue("defaultFeeRupees", String(toRupees(kind.defaults.feePaise)))
    }
  }

  async function onSubmit() {
    // The action re-parses from scratch, so hand it the raw form values —
    // passing the already-transformed paise would be parsed as rupees again.
    const raw = form.getValues()
    const result = isEdit
      ? await updateProgram({ ...raw, id: program!.id })
      : await createProgram(raw)

    if (!result.ok) {
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          form.setError(field as keyof ProgramFormValues, { message })
        }
      }
      toast.error(result.error)
      return
    }

    toast.success(isEdit ? "Program updated" : "Program created")
    router.push(`/programs/${result.data.id}`)
    router.refresh()
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-3xl space-y-6 px-4 py-4 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="SMC Mentorship Pune" {...field} />
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
                    placeholder="SMC-PUNE"
                    {...field}
                    onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                  />
                </FormControl>
                <FormDescription>Short unique reference.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/*
            ONE selector for type + delivery mode. It writes two independent
            columns so queries can still ask about type and mode separately.
          */}
          <FormField
            control={form.control}
            name="kind"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Program type</FormLabel>
                <Select value={field.value} onValueChange={onKindChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {PROGRAM_KINDS.map((kind) => (
                      <SelectItem key={kind.value} value={kind.value}>
                        {kind.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Decides whether batches ask for a meeting link or a venue.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="defaultFeeRupees"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Default fee (₹)</FormLabel>
                <FormControl>
                  <Input
                    inputMode="decimal"
                    placeholder="45000"
                    {...field}
                    value={String(field.value ?? "")}
                  />
                </FormControl>
                <FormDescription>
                  {billingType === "RECURRING" ? "Per billing cycle." : "Total fee."}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="defaultDurationDays"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Duration (days)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="Optional"
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
            name="defaultBillingType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Billing</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={(v) => {
                    field.onChange(v ?? "ONE_TIME")
                    if (v !== "RECURRING") form.setValue("defaultBillingCycle", null)
                    else if (!form.getValues("defaultBillingCycle"))
                      form.setValue("defaultBillingCycle", "MONTHLY")
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

          {/* A cycle only means anything for recurring billing. */}
          {billingType === "RECURRING" ? (
            <FormField
              control={form.control}
              name="defaultBillingCycle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Billing cycle</FormLabel>
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
          ) : null}

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "DRAFT")}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {PROGRAM_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {PROGRAM_STATUS_LABELS[s]}
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
            name="description"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea rows={3} {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Create program"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  )
}
