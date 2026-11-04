"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { LogOut, Monitor, Moon, ShieldCheck, Sun, UserRound } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuGroupLabel,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { signOut } from "@/lib/auth-client"

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
}

/*
 * The theme contract, shared with the inline script in app/layout.tsx (which
 * applies it before first paint) and the sign-in page's toggle:
 * localStorage.theme is "light", "dark" or "system"; "system" follows
 * prefers-color-scheme; nothing stored means dark. The class on <html> is
 * what everything else (the tokens, the toaster) reads.
 */
type Theme = "system" | "light" | "dark"

const DARK_QUERY = "(prefers-color-scheme: dark)"

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem("theme")
    return stored === "light" || stored === "system" ? stored : "dark"
  } catch {
    return "dark"
  }
}

function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia(DARK_QUERY).matches)
  const classes = document.documentElement.classList
  classes.toggle("dark", dark)
  classes.toggle("light", !dark)
}

export function UserMenu({
  name,
  email,
  role,
  canManageUsers = false,
}: {
  name: string
  email: string
  role: string
  canManageUsers?: boolean
}) {
  const router = useRouter()
  // Dark until the first effect reads what is stored, so the server and the
  // first client render agree.
  const [theme, setTheme] = useState<Theme>("dark")

  useEffect(() => {
    setTheme(readTheme())
  }, [])

  // While "system" is chosen, follow the OS as it changes (sunset, a toggle
  // in Settings) without a reload.
  useEffect(() => {
    if (theme !== "system") return
    const query = window.matchMedia(DARK_QUERY)
    const follow = () => applyTheme("system")
    query.addEventListener("change", follow)
    return () => query.removeEventListener("change", follow)
  }, [theme])

  function chooseTheme(next: Theme) {
    try {
      localStorage.setItem("theme", next)
    } catch {
      // Private mode or storage blocked: the choice still applies for this page.
    }
    applyTheme(next)
    setTheme(next)
  }

  async function handleSignOut() {
    await signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <DropdownMenu>
      {/* The avatar is the button: a 36px disc of flat glass with the initials in gold. */}
      <DropdownMenuTrigger
        aria-label={`${name}: account menu`}
        className="glass-tint press flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-primary outline-none transition-colors hover:bg-glass-hover focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:bg-glass-hover"
      >
        {initials(name)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center gap-2.5">
            <Avatar>
              <AvatarFallback>{initials(name)}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-sm font-semibold text-foreground">{name}</span>
              <span className="truncate text-xs text-muted-foreground">{email}</span>
              <span className="mt-1 inline-flex w-fit items-center rounded-full border border-primary/30 bg-accent px-1.5 py-0.5 text-[0.625rem] font-medium uppercase tracking-wider text-accent-foreground">
                {role}
              </span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          render={<Link href="/settings/profile" />}
          className="cursor-pointer"
        >
          <UserRound className="size-4 text-primary" aria-hidden />
          <span>Your profile</span>
        </DropdownMenuItem>
        {canManageUsers ? (
          <DropdownMenuItem
            render={<Link href="/settings/team" />}
            className="cursor-pointer"
          >
            <ShieldCheck className="size-4 text-primary" aria-hidden />
            <span>Team</span>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        {/* Picking a theme keeps the menu open (radio items do), so the change is seen at once. */}
        <DropdownMenuGroup>
          <DropdownMenuGroupLabel>Appearance</DropdownMenuGroupLabel>
          <DropdownMenuRadioGroup value={theme} onValueChange={(value) => chooseTheme(value as Theme)}>
            <DropdownMenuRadioItem value="system" className="cursor-pointer">
              <Monitor className="size-4 text-primary" aria-hidden />
              <span>System</span>
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="light" className="cursor-pointer">
              <Sun className="size-4 text-primary" aria-hidden />
              <span>Light</span>
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark" className="cursor-pointer">
              <Moon className="size-4 text-primary" aria-hidden />
              <span>Dark</span>
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive focus:text-destructive">
          <LogOut className="size-4" aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
