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
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur-sm lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      <ul className="grid grid-cols-5">
        {MOBILE_TABS.map((tab) => {
          const active = isActivePath(pathname, tab.href)
          const Icon = tab.icon

          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 text-[0.625rem] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="size-5" aria-hidden />
                {tab.label}
              </Link>
            </li>
          )
        })}

        <li>
          <button
            type="button"
            onClick={onOpenMenu}
            className="flex w-full flex-col items-center gap-0.5 py-2 text-[0.625rem] font-medium text-muted-foreground"
          >
            <Menu className="size-5" aria-hidden />
            More
          </button>
        </li>
      </ul>
    </nav>
  )
}
