import Link from "next/link"
import { ChevronLeft } from "lucide-react"

/**
 * The heading block every page opens with.
 *
 * On a phone the primary action sits on its own row at full width rather than
 * being squeezed beside the title — a 44px target the thumb can hit without
 * aiming. `back` renders a real link rather than a history-back button so it
 * works on a cold load from a shared URL.
 */
export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: string
  description?: React.ReactNode
  actions?: React.ReactNode
  back?: { href: string; label: string }
}) {
  return (
    <div className="border-b px-4 py-4 sm:px-6 sm:py-5">
      {back ? (
        <Link
          href={back.href}
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {back.label}
        </Link>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl">{title}</h1>
          {description ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>

        {actions ? (
          <div className="flex w-full shrink-0 gap-2 sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/** Section heading used inside pages, above a table or a card grid. */
export function SectionHeading({
  children,
  action,
}: {
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
        {children}
      </h2>
      {action}
    </div>
  )
}
