import { AppShell } from "@/components/layout/app-shell"
import { requireUser } from "@/lib/session"

/**
 * The gate for every authenticated route. `requireUser()` redirects to /login
 * when there is no session or the account has been deactivated, so no page
 * below this layout has to check again.
 */
export const dynamic = "force-dynamic"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireUser()

  return (
    <AppShell user={{ name: user.name, email: user.email, role: user.role }}>
      {children}
    </AppShell>
  )
}
