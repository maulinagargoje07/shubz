"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "cn"

import { isActivePath, NAV_SECTIONS } from "./nav"

/**
 * Desktop sidebar. Client-side only because it reads the pathname to mark the
 * current item — which is worth the few hundred bytes, since without it the
 * user cannot tell where they are.
 */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-6 p-3" aria-label="Main">
      {NAV_SECTIONS.map((section) => (
        <div key={section.heading}>
          <p className="px-3 pb-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground/75">
            {section.heading}
          </p>
          <ul className="space-y-1">
            {section.items.map((item) => {
              const active = isActivePath(pathname, item.href)
              const Icon = item.icon

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                      active
                        ? "border border-primary/30 bg-primary/15 font-semibold text-primary shadow-xs"
                        : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground active:scale-[0.99]"
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-4 shrink-0 transition-colors",
                        active ? "text-primary" : "text-muted-foreground"
                      )}
                      aria-hidden
                    />
                    <span className="truncate">{item.label}</span>
                    {item.comingSoon ? (
                      <span className="ml-auto rounded border border-border/50 bg-secondary px-1.5 py-0.5 text-[0.625rem] uppercase tracking-wide text-muted-foreground">
                        Soon
                      </span>
                    ) : null}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
