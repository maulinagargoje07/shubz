import { redirect } from "next/navigation"

import { getSessionUser } from "@/lib/session"
import { LoginForm } from "./login-form"

export const dynamic = "force-dynamic"

export const metadata = { title: "Sign in · ShubzTrader" }

export default async function LoginPage() {
  // Already signed in — no reason to show the form again.
  if (await getSessionUser()) redirect("/dashboard")

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">ShubzTrader</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Student management &amp; CRM
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  )
}
