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
import { LIFECYCLE_LABELS, SOURCE_LABELS } from "@/lib/labels"
import {
  contactFormSchema,
  CONTACT_SOURCES,
  LIFECYCLE_STAGES,
  type ContactFormValues,
} from "@/lib/validation/contact"
import { createContact, updateContact } from "@/server/contacts/actions"

export function ContactForm({
  contact,
}: {
  contact?: {
    id: string
    fullName: string
    phoneRaw: string | null
    phoneE164: string
    altPhone: string | null
    email: string | null
    city: string | null
    state: string | null
    lifecycleStage: (typeof LIFECYCLE_STAGES)[number]
    source: (typeof CONTACT_SOURCES)[number]
    telegramUsername: string | null
    tradingviewUsername: string | null
    notes: string | null
  }
}) {
  const router = useRouter()
  const isEdit = Boolean(contact)

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      fullName: contact?.fullName ?? "",
      // Show what was originally typed; it normalises again on save.
      phone: contact?.phoneRaw ?? contact?.phoneE164 ?? "",
      altPhone: contact?.altPhone ?? "",
      email: contact?.email ?? "",
      city: contact?.city ?? "",
      state: contact?.state ?? "",
      lifecycleStage: contact?.lifecycleStage ?? "LEAD",
      source: contact?.source ?? "OTHER",
      telegramUsername: contact?.telegramUsername ?? "",
      tradingviewUsername: contact?.tradingviewUsername ?? "",
      notes: contact?.notes ?? "",
    },
  })

  async function onSubmit(values: ContactFormValues) {
    const result = isEdit
      ? await updateContact({ ...values, id: contact!.id })
      : await createContact(values)

    if (!result.ok) {
      // Server-side field errors (a duplicate phone, most often) land on the
      // field that caused them rather than in a generic banner.
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          form.setError(field as keyof ContactFormValues, { message })
        }
      }
      toast.error(result.error)
      return
    }

    toast.success(isEdit ? "Contact updated" : "Contact added")
    router.push(`/contacts/${result.data.id}`)
    router.refresh()
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-3xl space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Full name</FormLabel>
                <FormControl>
                  <Input placeholder="Ravi Kumar" {...field} />
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
                  <Input placeholder="9876543210" {...field} />
                </FormControl>
                <FormDescription>
                  Indian numbers can be typed plain — stored as +91…
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="altPhone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Alternate phone</FormLabel>
                <FormControl>
                  <Input placeholder="Optional" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="Optional" {...field} value={field.value ?? ""} />
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
                <FormLabel>City</FormLabel>
                <FormControl>
                  <Input placeholder="Pune" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="state"
            render={({ field }) => (
              <FormItem>
                <FormLabel>State</FormLabel>
                <FormControl>
                  <Input placeholder="Maharashtra" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="lifecycleStage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stage</FormLabel>
                <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "LEAD")}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {LIFECYCLE_STAGES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {LIFECYCLE_LABELS[s]}
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
            name="source"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Source</FormLabel>
                <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "OTHER")}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CONTACT_SOURCES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {SOURCE_LABELS[s]}
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
            name="telegramUsername"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telegram</FormLabel>
                <FormControl>
                  <Input placeholder="@username" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="tradingviewUsername"
            render={({ field }) => (
              <FormItem>
                <FormLabel>TradingView</FormLabel>
                <FormControl>
                  <Input placeholder="username" {...field} value={field.value ?? ""} />
                </FormControl>
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
                  <Textarea rows={3} {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Add contact"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  )
}
