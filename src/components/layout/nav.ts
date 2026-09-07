import type { Permission } from "@/lib/permissions"

import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  IndianRupee,
  Layers,
  LayoutDashboard,
  Megaphone,
  MessageSquareText,
  Receipt,
  Upload,
  ShieldCheck,
  UserPlus,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  /** Marks routes that exist but are not built in this pass. */
  comingSoon?: boolean
  /**
   * Hide this item unless the viewer holds the permission. Presentation only —
   * the page itself re-checks, since hiding a link is not access control.
   */
  permission?: Permission
}

export const NAV_SECTIONS: { heading: string; items: NavItem[] }[] = [
  {
    heading: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    heading: "People",
    items: [
      { href: "/leads", label: "Leads", icon: UserPlus, permission: "MANAGE_CONTACTS" },
      { href: "/contacts", label: "Contacts", icon: Users },
      { href: "/students", label: "Students", icon: GraduationCap },
    ],
  },
  {
    heading: "Catalogue",
    items: [
      { href: "/programs", label: "Programs", icon: BookOpen },
      { href: "/batches", label: "Batches", icon: Layers, permission: "MANAGE_PROGRAMS" },
      { href: "/sessions", label: "Sessions", icon: CalendarDays },
      { href: "/attendance", label: "Attendance", icon: ClipboardCheck },
    ],
  },
  {
    heading: "Money",
    items: [
      { href: "/enrollments", label: "Enrollments", icon: Receipt },
      { href: "/payments", label: "Payments", icon: IndianRupee, permission: "VIEW_FINANCIALS" },
      { href: "/fees", label: "Fees", icon: IndianRupee, permission: "VIEW_FINANCIALS" },
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
  {
    heading: "Tools",
    items: [
      { href: "/imports", label: "Import", icon: Upload },
      { href: "/campaigns", label: "Campaigns", icon: Megaphone, comingSoon: true },
      { href: "/templates", label: "Templates", icon: MessageSquareText, comingSoon: true },
    ],
  },
]

export const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap((s) => s.items)

/** Sections filtered to what this viewer may see, dropping any left empty. */
export function visibleSections(permissions: readonly Permission[], role: string) {
  const holds = (p: Permission) => role === "SUPERADMIN" || permissions.includes(p)
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.permission || holds(item.permission)),
  })).filter((section) => section.items.length > 0)
}

/**
 * The five destinations that get a permanent slot in the phone tab bar.
 *
 * Chosen from what the daily job actually is: check what is owed, look someone
 * up, mark a register. Everything else stays one tap away behind "More", which
 * is the right trade for a bar that must not scroll.
 */
export const MOBILE_TABS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/enrollments", label: "Records", icon: Receipt },
  { href: "/fees", label: "Fees", icon: IndianRupee },
  { href: "/attendance", label: "Mark", icon: ClipboardCheck },
]

/**
 * Whether a nav item should render as current.
 *
 * Prefix matching so /contacts/<id> keeps Contacts lit, but exact-only for
 * "/" style roots that would otherwise match everything below them.
 */
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}
