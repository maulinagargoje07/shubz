"use client"

import { useState } from "react"
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
import { signOut } from "@/lib/auth-client"
import {
  MIN_PASSWORD_LENGTH,
  changePasswordSchema,
  updateProfileSchema,
  type ChangePasswordValues,
  type UpdateProfileValues,
} from "@/lib/validation/profile"
import { changeOwnPassword, updateOwnProfile } from "@/server/profile/actions"

export function EditNameForm({ name }: { name: string }) {
  const router = useRouter()

  const form = useForm<UpdateProfileValues>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { name },
  })

  async function onSubmit(values: UpdateProfileValues) {
    const result = await updateOwnProfile(values)

    if (!result.ok) {
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          form.setError(field as keyof UpdateProfileValues, { message })
        }
      }
      toast.error(result.error)
      return
    }

    toast.success("Profile updated")
    router.refresh()
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Display name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormDescription>
                Shown on records you create and in the audit log.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
          {form.formState.isSubmitting ? "Saving…" : "Save name"}
        </Button>
      </form>
    </Form>
  )
}

export function ChangePasswordForm() {
  const router = useRouter()
  const [done, setDone] = useState(false)

  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  })

  async function onSubmit(values: ChangePasswordValues) {
    const result = await changeOwnPassword(values)

    if (!result.ok) {
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          form.setError(field as keyof ChangePasswordValues, { message })
        }
      }
      toast.error(result.error)
      return
    }

    setDone(true)
    toast.success("Password changed", {
      description: "Signing you out so you can use the new one.",
    })

    // Every session was revoked server-side, including this one. Clearing the
    // cookie and sending them to /login is the honest end to that.
    await signOut().catch(() => {})
    setTimeout(() => {
      router.push("/login")
      router.refresh()
    }, 1200)
  }

  if (done) {
    return (
      <p className="rounded-lg border border-paid/30 bg-paid-muted px-3 py-2 text-sm text-paid-foreground">
        Password changed. Signing you out…
      </p>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="currentPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Current password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Repeat new password</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Changing your password signs you out everywhere, including here.
        </p>

        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Changing…" : "Change password"}
        </Button>
      </form>
    </Form>
  )
}

/** Sign out, available as a plain button for the profile page and mobile menu. */
export function SignOutButton({
  className,
  variant = "outline",
}: {
  className?: string
  variant?: "outline" | "ghost" | "destructive"
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handle() {
    setBusy(true)
    await signOut().catch(() => {})
    router.push("/login")
    router.refresh()
  }

  return (
    <Button variant={variant} onClick={handle} disabled={busy} className={className}>
      {busy ? "Signing out…" : "Sign out"}
    </Button>
  )
}
