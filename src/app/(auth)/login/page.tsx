import type { CSSProperties } from "react"
import Image from "next/image"
import { redirect } from "next/navigation"

import { Backdrop } from "@/components/layout/backdrop"
import { homePathFor } from "@/lib/permissions"
import { getSessionUser } from "@/lib/session"
import { LoginForm } from "./login-form"
import { LoginScene } from "./login-scene"
import { ThemeToggle } from "./theme-toggle"
import "./login.css"

export const dynamic = "force-dynamic"

export const metadata = { title: "Sign in" }

/*
 * A pane of glass in front of the crown. The page stays a server component
 * (it checks the session and redirects); the form, the scene behind it and
 * the theme toggle are the client islands. The pieces arrive in order: logo
 * and wordmark, then the card 80ms later, then the footer.
 */
export default async function LoginPage() {
  // Already signed in — no reason to show the form again.
  const user = await getSessionUser()
  if (user) redirect(homePathFor(user))

  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-background p-6">
      <Backdrop />
      <div className="relative z-10 w-full max-w-sm">
        <div className="login-rise mb-8 flex flex-col items-center text-center">
          <div className="login-logo mb-3 size-24">
            <Image src="/logo.png" alt="ShubzTrader" width={96} height={96} priority className="size-24" />
            {/* The one-time band of light across the logo, 400ms after it lands. */}
            <span className="login-gleam" aria-hidden />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            $hubz<span className="font-semibold text-primary">Trader</span>
          </h1>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Indicator Admin
          </p>
        </div>

        {/* The scene sits in this wrapper so the crown is placed from the card, not the page. */}
        <div className="relative">
          <LoginScene />
          <LoginForm />
        </div>

        <p
          className="login-rise mt-6 text-center text-xs text-muted-foreground"
          style={{ "--d": "160ms" } as CSSProperties}
        >
          Internal tool. Contact your administrator for access.
        </p>
      </div>
      <ThemeToggle />
    </main>
  )
}
