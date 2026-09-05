"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { MobileTabs } from "./mobile-tabs"
import { SidebarNav } from "./sidebar"
import { UserMenu } from "./user-menu"

export function AppShell({
  user,
  children,
}: {
  user: { name: string; email: string; role: string }
  children: React.ReactNode
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()

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
    <div className="min-h-svh">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-card/90 px-4 backdrop-blur-sm sm:px-6">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight">
          <span
            aria-hidden
            className="flex size-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground"
          >
            ST
          </span>
          <span className="hidden sm:inline">ShubzTrader</span>
        </Link>

        <div className="ml-auto">
          <UserMenu name={user.name} email={user.email} role={user.role} />
        </div>
      </header>

      <div className="flex">
        <aside className="sticky top-14 hidden h-[calc(100svh-3.5rem)] w-56 shrink-0 overflow-y-auto border-r lg:block">
          <SidebarNav />
        </aside>

        {/*
          Bottom padding on mobile clears the fixed tab bar, so the last row of
          a list is never trapped underneath it.
        */}
        <main className="min-w-0 flex-1 pb-20 lg:pb-0">{children}</main>
      </div>

      <MobileTabs onOpenMenu={() => setMenuOpen(true)} />

      {menuOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-foreground/30 backdrop-blur-[2px]"
            onClick={() => setMenuOpen(false)}
          />
          {/* Anchored to the bottom, next to the thumb that opened it. */}
          <div className="absolute inset-x-0 bottom-0 max-h-[80svh] overflow-y-auto rounded-t-2xl border-t bg-card pb-[env(safe-area-inset-bottom)]">
            <div className="sticky top-0 flex items-center justify-between border-b bg-card px-4 py-3">
              <span className="font-medium">Menu</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
              >
                <X className="size-5" />
              </Button>
            </div>
            <SidebarNav onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      ) : null}
    </div>
  )
}
