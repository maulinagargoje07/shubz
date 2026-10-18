import type { Permission } from "@/lib/permissions"

import {
  CircleAlert,
  IndianRupee,
  LayoutDashboard,
  ShieldCheck,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  /**
   * Hide this item unless the viewer holds the permission. Presentation only —
   * the page itself re-checks, since hiding a link is not access control.
   */
  permission?: Permission
  /** Lit only on this exact path, not the pages below it. */
  exact?: boolean
}

export const NAV_SECTIONS: { heading: string; items: NavItem[] }[] = [
  {
    heading: "Indicator",
    items: [
      { href: "/indicator", label: "Overview", icon: LayoutDashboard, permission: "VIEW_INDICATOR", exact: true },
      { href: "/indicator/subscribers", label: "Subscribers", icon: Users, permission: "VIEW_INDICATOR" },
      { href: "/indicator/payments", label: "Payments", icon: IndianRupee, permission: "VIEW_INDICATOR" },
      { href: "/indicator/failed", label: "Failed payments", icon: CircleAlert, permission: "VIEW_INDICATOR" },
    ],
  },
  {
    heading: "Account",
    items: [
      // No permission: everyone has a profile.
      { href: "/settings/profile", label: "Your profile", icon: UserRound },
      { href: "/settings/team", label: "Team", icon: ShieldCheck, permission: "MANAGE_USERS" },
    ],
  },
]

function holds(permissions: readonly Permission[], role: string, item: NavItem): boolean {
  return !item.permission || role === "SUPERADMIN" || permissions.includes(item.permission)
}

/** Sections filtered to what this viewer may see, dropping any left empty. */
export function visibleSections(permissions: readonly Permission[], role: string) {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => holds(permissions, role, item)),
  })).filter((section) => section.items.length > 0)
}

/**
 * The destinations that get a permanent slot in the phone tab bar: the four
 * Indicator pages. Everything else stays one tap away behind "More".
 */
export const MOBILE_TABS: NavItem[] = [
  { href: "/indicator", label: "Overview", icon: LayoutDashboard, permission: "VIEW_INDICATOR", exact: true },
  { href: "/indicator/subscribers", label: "Subscribers", icon: Users, permission: "VIEW_INDICATOR" },
  { href: "/indicator/payments", label: "Payments", icon: IndianRupee, permission: "VIEW_INDICATOR" },
  { href: "/indicator/failed", label: "Failed", icon: CircleAlert, permission: "VIEW_INDICATOR" },
]

export function visibleTabs(permissions: readonly Permission[], role: string): NavItem[] {
  return MOBILE_TABS.filter((item) => holds(permissions, role, item))
}

/**
 * Whether a nav item should render as current.
 *
 * Prefix matching so /indicator/subscribers?page=2 keeps Subscribers lit, but
 * exact-only for items like the overview, whose path sits above the others.
 */
export function isActivePath(pathname: string, item: Pick<NavItem, "href" | "exact">): boolean {
  if (pathname === item.href) return true
  return !item.exact && pathname.startsWith(`${item.href}/`)
}
