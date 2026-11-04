"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"
import { cn } from "cn"

import type { Permission } from "@/lib/permissions"
import { LinkPending } from "./link-pending"
import { isActivePath, visibleTabs } from "./nav"

/**
 * The phone tab bar.
 *
 * A hamburger drawer is the wrong primary navigation for a tool used standing
 * up at a desk with one hand: it hides every destination behind a tap and puts
 * them at the top of a tall screen. A fixed bottom bar keeps the four things
 * pages this job actually involves within thumb reach, with "More" opening the
 * full menu for everything else.
 *
 * `pb-[env(safe-area-inset-bottom)]` keeps the bar clear of the iOS home
 * indicator; without it the last few pixels of every tab are unpressable.
 */
// Literal class names, so Tailwind sees every one of them.
const GRID_COLS = ["grid-cols-1", "grid-cols-2", "grid-cols-3", "grid-cols-4", "grid-cols-5"]

export function MobileTabs({
  onOpenMenu,
  permissions,
  role,
}: {
  onOpenMenu: () => void
  permissions: Permission[]
  role: string
}) {
  const pathname = usePathname()
  const tabs = visibleTabs(permissions, role)

  return (
    <nav
      className="fixed inset-x-3 bottom-0 z-30 lg:hidden"
      style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
      aria-label="Primary"
    >
      {/* A floating capsule of glass, like a phone's own tab bar; the current tab a capsule of flat glass inside it. */}
      <ul className={cn("glass grid items-center rounded-[1.75rem] px-1.5 py-1.5", GRID_COLS[tabs.length])}>
        {tabs.map((tab) => {
          const active = isActivePath(pathname, tab)
          const Icon = tab.icon

          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "press relative flex flex-col items-center justify-center gap-0.5 rounded-full py-1 text-[0.6875rem] font-medium transition-colors",
                  active
                    ? "glass-tint font-semibold text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {active ? null : <LinkPending className="absolute top-1 right-3" />}
                <div className="flex size-7 items-center justify-center">
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
            className="press flex w-full flex-col items-center justify-center gap-0.5 rounded-full py-1 text-[0.6875rem] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <div className="flex size-7 items-center justify-center">
              <Menu className="size-4.5" aria-hidden />
            </div>
            <span>More</span>
          </button>
        </li>
      </ul>
    </nav>
  )
}
