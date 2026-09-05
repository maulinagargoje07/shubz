import { redirect } from "next/navigation"

import { getSessionUser } from "@/lib/session"
import { LoginForm } from "./login-form"

export const dynamic = "force-dynamic"

export const metadata = { title: "Sign in · ShubzTrader" }

export default async function LoginPage() {
  // Already signed in — no reason to show the form again.
  if (await getSessionUser()) redirect("/dashboard")

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span
            aria-hidden
            className="mb-3 flex size-11 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground"
          >
            ST
          </span>
          <h1 className="text-xl font-semibold tracking-tight">ShubzTrader</h1>
          <p className="mt-1 text-sm text-muted-foreground">Student management &amp; CRM</p>
        </div>

        <LoginForm />

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Internal tool. Contact your administrator for access.
        </p>
      </div>
    </main>
  )
}
