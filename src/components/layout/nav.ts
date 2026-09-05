import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  IndianRupee,
  LayoutDashboard,
  Megaphone,
  MessageSquareText,
  Receipt,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  /** Marks routes that exist but are not built in this pass. */
  comingSoon?: boolean
}

export const NAV_SECTIONS: { heading: string; items: NavItem[] }[] = [
  {
    heading: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    heading: "People",
    items: [
      { href: "/contacts", label: "Contacts", icon: Users },
      { href: "/students", label: "Students", icon: GraduationCap },
    ],
  },
  {
    heading: "Catalogue",
    items: [
      { href: "/programs", label: "Programs", icon: BookOpen },
      { href: "/sessions", label: "Sessions", icon: CalendarDays },
      { href: "/attendance", label: "Attendance", icon: ClipboardCheck },
    ],
  },
  {
    heading: "Money",
    items: [
      { href: "/enrollments", label: "Enrollments", icon: Receipt },
      { href: "/payments", label: "Payments", icon: IndianRupee },
      { href: "/fees", label: "Fees", icon: IndianRupee },
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
