"use client"

import { useLayoutEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "cn"

import { LinkPending } from "./link-pending"
import { isActivePath, visibleSections } from "./nav"
import type { Permission } from "@/lib/permissions"

/**
 * Desktop sidebar (and the list inside the phone drawer). Client-side only
 * because it reads the pathname to mark the current item — which is worth
 * the few hundred bytes, since without it the user cannot tell where they are.
 *
 * The current item sits on one knob of flat glass that slides to whichever
 * item is current: it is measured from the active link after every
 * navigation (and whenever the list resizes), so the knob is one element
 * moving rather than one appearing and another vanishing. The gold text and
 * the gold bar are on the link itself, so they are there before hydration.
 */
export function SidebarNav({
  onNavigate,
  permissions = [],
  role = "ADMIN",
}: {
  onNavigate?: () => void
  permissions?: Permission[]
  role?: string
}) {
  const pathname = usePathname()
  const sections = visibleSections(permissions, role)

  const navRef = useRef<HTMLElement | null>(null)
  const [knob, setKnob] = useState<{ top: number; left: number; width: number; height: number } | null>(null)

  useLayoutEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const measure = () => {
      const active = nav.querySelector<HTMLElement>('a[aria-current="page"]')
      if (!active) {
        setKnob(null)
        return
      }
      // offsetTop/offsetLeft are relative to the nav, which is positioned.
      setKnob({ top: active.offsetTop, left: active.offsetLeft, width: active.offsetWidth, height: active.offsetHeight })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(nav)
    return () => observer.disconnect()
  }, [pathname])

  return (
    <nav ref={navRef} className="relative flex flex-col gap-6 p-3" aria-label="Main">
      {knob ? (
        <span
          aria-hidden
          className="glass-tint absolute top-0 left-0 rounded-xl transition-transform duration-[220ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]"
          style={{
            width: knob.width,
            height: knob.height,
            transform: `translate(${knob.left}px, ${knob.top}px)`,
          }}
        />
      ) : null}
      {sections.map((section) => (
        <div key={section.heading}>
          <p className="px-3 pb-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground/80">
            {section.heading}
          </p>
          <ul className="space-y-1">
            {section.items.map((item) => {
              const active = isActivePath(pathname, item)
              const Icon = item.icon

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "press relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-200",
                      active
                        ? // The gold bar down the left edge of the knob.
                          "font-semibold text-primary before:absolute before:top-2.5 before:bottom-2.5 before:left-0.5 before:w-0.5 before:rounded-full before:bg-primary"
                        : "text-muted-foreground hover:bg-glass-hover hover:text-foreground"
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
                    <LinkPending className="ml-auto" />
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
