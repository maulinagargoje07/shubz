"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"
import { cn } from "cn"

import { isActivePath, MOBILE_TABS } from "./nav"

/**
 * The phone tab bar.
 *
 * A hamburger drawer is the wrong primary navigation for a tool used standing
 * up at a desk with one hand: it hides every destination behind a tap and puts
 * them at the top of a tall screen. A fixed bottom bar keeps the four things
 * this job actually involves within thumb reach, with "More" opening the full
 * menu for everything else.
 *
 * `pb-[env(safe-area-inset-bottom)]` keeps the bar clear of the iOS home
 * indicator; without it the last few pixels of every tab are unpressable.
 */
export function MobileTabs({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname()

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[#D4AF37]/20 bg-[#080808]/95 shadow-[0_-4px_20px_rgba(0,0,0,0.6)] backdrop-blur-md lg:hidden"
      style={{ paddingBottom: "calc(0.25rem + env(safe-area-inset-bottom))" }}
      aria-label="Primary"
    >
      <ul className="grid grid-cols-5 items-center py-1">
        {MOBILE_TABS.map((tab) => {
          const active = isActivePath(pathname, tab.href)
          const Icon = tab.icon

          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1 py-1 text-[0.6875rem] font-medium transition-all active:scale-95",
                  active
                    ? "font-semibold text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {active ? (
                  <span
                    aria-hidden
                    className="absolute -top-1 size-1 rounded-full bg-primary gold-glow-sm"
                  />
                ) : null}
                <div
                  className={cn(
                    "flex size-7 items-center justify-center rounded-lg transition-colors",
                    active ? "bg-primary/15 text-primary" : ""
                  )}
                >
                  <Icon className="size-4.5" aria-hidden />
                </div>
                <span>{tab.label}</span>
              </Link>
            </li>
          )
        })}

        <li>
          <button
            type="button"
            onClick={onOpenMenu}
            className="flex w-full flex-col items-center justify-center gap-1 py-1 text-[0.6875rem] font-medium text-muted-foreground transition-all hover:text-foreground active:scale-95"
          >
            <div className="flex size-7 items-center justify-center rounded-lg">
              <Menu className="size-4.5" aria-hidden />
            </div>
            <span>More</span>
          </button>
        </li>
      </ul>
    </nav>
  )
}
