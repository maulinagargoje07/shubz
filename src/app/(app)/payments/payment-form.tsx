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
import { todayIST } from "@/lib/fy"
import { formatINR } from "@/lib/money"
import { PAYMENT_METHOD_LABELS } from "@/lib/labels"
import {
  PAYMENT_METHODS,
  paymentFormSchema,
  type PaymentFormParsed,
  type PaymentFormValues,
} from "@/lib/validation/payment"
import { recordPayment } from "@/server/payments/actions"

export function RecordPaymentDialog({
  enrollmentId,
  balanceDuePaise,
  nextDueAmountPaise,
  trigger,
}: {
  enrollmentId: string
  balanceDuePaise: number
  nextDueAmountPaise: number | null
  trigger: React.ReactElement
}) {
  const router = useRouter()

  const form = useForm<PaymentFormValues, FormContext, PaymentFormParsed>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      enrollmentId,
      // Pre-fill the instalment that is actually due, which is what an admin
      // taking a payment at the desk almost always enters.
      amountRupees: nextDueAmountPaise ? String(nextDueAmountPaise / 100) : "",
      paidOn: todayIST(),
      method: "UPI",
      referenceNo: "",
      notes: "",
    },
  })

  async function onSubmit() {
    const raw = form.getValues()
    const result = await recordPayment(raw)

    if (!result.ok) {
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          form.setError(field as keyof PaymentFormValues, { message })
        }
      }
      toast.error(result.error)
      return
    }

    toast.success(`Payment recorded · ${result.data.receiptNo}`)
    form.reset({
      enrollmentId,
      amountRupees: "",
      paidOn: todayIST(),
      method: "UPI",
      referenceNo: "",
      notes: "",
    })
    router.refresh()
  }

  return (
    <Dialog>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="amountRupees"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount (₹)</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="decimal"
                      autoFocus
                      placeholder="15000"
                      {...field}
                      value={String(field.value ?? "")}
                    />
                  </FormControl>
                  <FormDescription>
                    Balance outstanding: {formatINR(Math.max(balanceDuePaise, 0))}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="paidOn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Paid on</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Method</FormLabel>
                    <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "UPI")}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PAYMENT_METHODS.map((m) => (
                          <SelectItem key={m} value={m}>
                            {PAYMENT_METHOD_LABELS[m]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="referenceNo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reference</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="UPI txn id / cheque no."
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
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Recording…" : "Record payment"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
