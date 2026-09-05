import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  IndianRupee,
  LayoutDashboard,
  Megaphone,
  MessageSquareText,
  Receipt,
  Upload,
  Users,
} from "lucide-react"

export type NavItem = {
  href: string
  label: string
  icon: typeof Users
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
      { href: "/students", label: "Students", icon: Users },
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
