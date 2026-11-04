"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { Check, Eye, EyeOff } from "lucide-react"
import { useForm } from "react-hook-form"
import { cn } from "cn"

import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { GlassPane } from "@/components/ui/glass"
import { Input } from "@/components/ui/input"
import { signIn } from "@/lib/auth-client"
import { loginSchema, type LoginValues } from "@/lib/validation/auth"

/*
 * The sign-in card: one gold-rimmed pane of glass. The form is react-hook-form
 * with the zod schema; Better Auth does the signing in. What the card adds is
 * feel: fields whose label lifts when they take focus, a show/hide eye, a
 * Caps Lock notice, a spinner while the request is out, a shake and a cleared
 * password when the details are wrong, and a gold sweep with a tick when they
 * are right, before the page turns.
 */

type Stage = "idle" | "submitting" | "success" | "leaving"

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

// The Input primitive draws its own border and focus ring; here the wrapper
// is the control (so the eye button sits inside the same glass), and the
// input itself is bare text.
const bareInput =
  "h-full min-h-0 w-full flex-1 border-0 bg-transparent px-3.5 text-base shadow-none focus-visible:border-0 focus-visible:ring-0 aria-invalid:border-0 aria-invalid:ring-0 disabled:bg-transparent dark:bg-transparent dark:disabled:bg-transparent dark:aria-invalid:border-0 md:text-sm"

export function LoginForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [stage, setStage] = useState<Stage>("idle")
  const [shaking, setShaking] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const alertRef = useRef<HTMLParagraphElement | null>(null)

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  // Under reduced motion the error line does not animate in through CSS
  // (globals.css collapses every animation), so it gets a short fade here.
  useEffect(() => {
    const el = alertRef.current
    if (!error || !el || !reducedMotion()) return
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: "ease" })
  }, [error])

  async function onSubmit(values: LoginValues) {
    setError(null)
    setStage("submitting")
    const { error } = await signIn.email({
      email: values.email,
      password: values.password,
    })

    if (error) {
      // Deliberately vague: distinguishing "no such user" from "wrong password"
      // tells an attacker which emails are registered.
      setError("Those details don't match an active account.")
      setStage("idle")
      form.setValue("password", "")
      setShaking(true)
      // The field takes focus again once it is no longer inert.
      requestAnimationFrame(() => form.setFocus("password"))
      return
    }

    // The root page sends each person to wherever their access starts.
    const go = () => {
      router.push("/")
      router.refresh()
    }
    if (reducedMotion()) {
      go()
      return
    }
    setStage("success")
    await wait(280)
    setStage("leaving")
    await wait(320)
    go()
  }

  const busy = stage !== "idle"
  const submitting = stage === "submitting"

  return (
    <GlassPane
      lens
      className={cn(
        "login-rise glass-gold rounded-3xl p-6",
        shaking && "login-shake",
        stage === "leaving" && "login-leave"
      )}
      style={{ "--d": "80ms" } as CSSProperties}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget && event.animationName === "loginShake") setShaking(false)
      }}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" aria-busy={busy || undefined}>
          {/* While the request is out the fields dim and stop taking input. */}
          <div
            className={cn("space-y-4 transition-opacity duration-200", busy && "opacity-60")}
            inert={busy || undefined}
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="group/field">
                  <FormLabel className="text-[13px] font-semibold text-muted-foreground transition-colors group-focus-within/field:text-foreground">
                    Email
                  </FormLabel>
                  <div className="glass-control flex h-11 items-center rounded-xl has-[[aria-invalid=true]]:border-overdue/60">
                    <FormControl>
                      <Input
                        type="email"
                        inputMode="email"
                        autoComplete="username"
                        autoCapitalize="none"
                        autoCorrect="off"
                        placeholder="you@shubztrader.in"
                        className={bareInput}
                        {...field}
                      />
                    </FormControl>
                  </div>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem className="group/field">
                  <FormLabel className="text-[13px] font-semibold text-muted-foreground transition-colors group-focus-within/field:text-foreground">
                    Password
                  </FormLabel>
                  <div className="glass-control flex h-11 items-center rounded-xl pr-1.5 has-[[aria-invalid=true]]:border-overdue/60">
                    <FormControl>
                      <Input
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        className={bareInput}
                        {...field}
                        onKeyDown={(event) => setCapsLock(event.getModifierState("CapsLock"))}
                        onKeyUp={(event) => setCapsLock(event.getModifierState("CapsLock"))}
                        onBlur={() => {
                          setCapsLock(false)
                          field.onBlur()
                        }}
                      />
                    </FormControl>
                    <button
                      type="button"
                      onClick={() => setShowPassword((on) => !on)}
                      aria-pressed={showPassword}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="glass-tint press inline-flex size-7 min-h-0 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:size-9"
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" aria-hidden />
                      ) : (
                        <Eye className="size-4" aria-hidden />
                      )}
                    </button>
                  </div>
                  <FormMessage className="text-xs" />
                  {capsLock ? (
                    <p className="text-xs text-pending-foreground" aria-live="polite">
                      Caps Lock is on
                    </p>
                  ) : null}
                </FormItem>
              )}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            aria-disabled={busy || undefined}
            tabIndex={busy ? -1 : undefined}
            className="btn-gold relative inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-semibold focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {stage === "success" || stage === "leaving" ? (
              <>
                <span className="login-sweep" aria-hidden />
                <Check className="size-5" strokeWidth={2.5} aria-hidden />
                <span className="sr-only">Signed in</span>
              </>
            ) : submitting ? (
              <>
                <span
                  className="login-spinner size-4 rounded-full border-2 border-current border-t-transparent"
                  aria-hidden
                />
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </button>

          {error ? (
            <p
              ref={alertRef}
              className="login-alert glass-tint rounded-xl border-overdue/50 px-3 py-2 text-sm text-overdue-foreground"
              role="alert"
            >
              {error}
            </p>
          ) : null}
        </form>
      </Form>
    </GlassPane>
  )
}
