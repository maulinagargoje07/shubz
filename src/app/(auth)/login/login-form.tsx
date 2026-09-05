"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { signIn } from "@/lib/auth-client"
import { loginSchema, type LoginValues } from "@/lib/validation/auth"

export function LoginForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  async function onSubmit(values: LoginValues) {
    setError(null)
    const { error } = await signIn.email({
      email: values.email,
      password: values.password,
    })

    if (error) {
      // Deliberately vague: distinguishing "no such user" from "wrong password"
      // tells an attacker which emails are registered.
      setError("Those details don't match an active account.")
      return
    }

    router.push("/dashboard")
    router.refresh()
  }

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-md card-gold">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    inputMode="email"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    placeholder="you@shubztrader.in"
                    className="h-10 bg-secondary/30"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="current-password" className="h-10 bg-secondary/30" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {error ? (
            <p
              className="rounded-lg border border-overdue/40 bg-overdue-muted/40 px-3 py-2 text-sm text-overdue-foreground"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <Button type="submit" className="h-11 w-full bg-primary text-primary-foreground font-semibold hover:bg-primary/90 gold-glow-sm active:scale-[0.98]" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </Form>
    </div>
  )
}
