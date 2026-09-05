import Image from "next/image"
import { redirect } from "next/navigation"

import { getSessionUser } from "@/lib/session"
import { LoginForm } from "./login-form"

export const dynamic = "force-dynamic"

export const metadata = { title: "Sign in · ShubzTrader" }

export default async function LoginPage() {
  // Already signed in — no reason to show the form again.
  if (await getSessionUser()) redirect("/dashboard")

  return (
    <main className="flex min-h-svh items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="relative mb-3 flex items-center justify-center">
            <Image
              src="/logo.png"
              alt="ShubzTrader Logo"
              width={100}
              height={100}
              priority
              className="drop-shadow-[0_12px_28px_rgba(212,175,55,0.35)]"
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            $hubz<span className="font-semibold text-primary">Trader</span>
          </h1>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
            Student Management &amp; CRM
          </p>
        </div>

        <LoginForm />

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Internal tool. Contact your administrator for access.
        </p>
      </div>
    </main>
  )
}
