"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LogOut, UserRound, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Backdrop } from "./backdrop"
import { MobileTabs } from "./mobile-tabs"
import { SidebarNav } from "./sidebar"
import { UserMenu } from "./user-menu"
import { signOut } from "@/lib/auth-client"
import type { Permission } from "@/lib/permissions"

export function AppShell({
  user,
  homeHref,
  children,
}: {
  user: { name: string; email: string; role: string; permissions: Permission[] }
  /** Where the logo goes: the indicator overview, or the profile for anyone without it. */
  homeHref: string
  children: React.ReactNode
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  // Navigating from inside the drawer should close it; otherwise the new page
  // renders behind a sheet the user has to dismiss by hand.
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  // A drawer over a scrollable page lets the page scroll behind it on touch,
  // which feels broken. Lock the body while it is open.
  useEffect(() => {
    if (!menuOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [menuOpen])

  // Escape closes the drawer, as it does every other dismissible surface.
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [menuOpen])

  return (
    <div className="relative min-h-svh bg-background text-foreground">
      {/* The wallpaper the glass panes lie on. Fixed, behind everything, no pointer events. */}
      <Backdrop />
      {/* A bar of see-through glass; the class draws the sheen along its bottom edge. */}
      <header className="glass-bar sticky top-0 z-20 flex h-14 items-center gap-3 px-4 sm:px-6">
        <Link href={homeHref} className="flex items-center gap-2.5 font-semibold tracking-tight transition-opacity hover:opacity-90">
          <Image
            src="/logo.png"
            alt="ShubzTrader"
            width={32}
            height={32}
            priority
            className="size-8 object-contain drop-shadow-md"
          />
          <span className="text-[0.9375rem] font-bold tracking-tight text-foreground sm:inline">
            $hubz<span className="font-semibold text-primary">Trader</span>
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <UserMenu
            name={user.name}
            email={user.email}
            role={user.role}
            canManageUsers={
              user.role === "SUPERADMIN" || user.permissions.includes("MANAGE_USERS")
            }
          />
        </div>
      </header>

      <div className="relative z-10 flex">
        {/* Not a bar: a clear column with a hairline, so the wall shows through it unblurred. */}
        <aside className="sticky top-14 hidden h-[calc(100svh-3.5rem)] w-56 shrink-0 overflow-y-auto border-r border-glass-rim lg:block">
          <SidebarNav permissions={user.permissions} role={user.role} />
        </aside>

        {/*
          Bottom padding clears the mobile tab bar + safe area on iOS/Android
        */}
        <main key={pathname} className="rise-in min-w-0 flex-1 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-8">
          {children}
        </main>
      </div>

      <MobileTabs
        onOpenMenu={() => setMenuOpen(true)}
        permissions={user.permissions}
        role={user.role}
      />

      {menuOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          {/* The scrim does not blur: the sheet on top of it already does, and a phone pays for every blurred layer. */}
          <button
            type="button"
            aria-label="Close menu"
            className="animate-in fade-in duration-200 absolute inset-0 bg-black/40"
            onClick={() => setMenuOpen(false)}
          />
          {/* Anchored to the bottom with slide-up animation and drag handle */}
          <div className="glass glass-regular animate-in slide-in-from-bottom duration-250 ease-out absolute inset-x-0 bottom-0 max-h-[85svh] overflow-y-auto rounded-t-3xl pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="mx-auto mt-2.5 mb-1 h-1 w-10 rounded-full bg-muted-foreground/30" />
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-glass-rim px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tracking-wide">Navigation</span>
                <span className="rounded-full border border-primary/30 bg-accent px-1.5 py-0.5 text-[0.625rem] font-medium uppercase tracking-wider text-accent-foreground">
                  Menu
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                className="size-8 rounded-full"
              >
                <X className="size-4.5" />
              </Button>
            </div>

            <div className="p-3">
              <SidebarNav
                onNavigate={() => setMenuOpen(false)}
                permissions={user.permissions}
                role={user.role}
              />

              {/*
                Sign out lives here as well as in the header menu: on a phone
                the header avatar is a small target and the sheet is where
                people already are.
              */}
              <div className="mt-3 space-y-2 border-t border-glass-rim pt-3">
                <Link
                  href="/settings/profile"
                  onClick={() => setMenuOpen(false)}
                  className="press flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-glass-hover hover:text-foreground"
                >
                  <UserRound className="size-4 shrink-0" aria-hidden />
                  Your profile
                </Link>
                <button
                  type="button"
                  onClick={async () => {
                    setMenuOpen(false)
                    await signOut().catch(() => {})
                    router.push("/login")
                    router.refresh()
                  }}
                  className="press flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                >
                  <LogOut className="size-4 shrink-0" aria-hidden />
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
