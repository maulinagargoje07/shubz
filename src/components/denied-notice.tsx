import { ShieldAlert } from "lucide-react"

/**
 * Shown on a landing page after a guard sent someone here (`?denied=1`), so a
 * blocked link explains itself instead of looking like a broken redirect.
 */
export function DeniedNotice({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <div className="px-4 pt-4 sm:px-6">
      <p
        role="status"
        className="flex items-start gap-2.5 rounded-xl border border-pending/30 bg-pending-muted px-4 py-3 text-sm text-pending-foreground"
      >
        <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        Your account doesn&apos;t have access to that page. Ask a superadmin if you need it.
      </p>
    </div>
  )
}
