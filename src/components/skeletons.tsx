/**
 * Loading skeletons.
 *
 * Every page in this app is dynamic and hits Postgres, so a navigation costs a
 * server round-trip. Without a loading state the user taps and stares at the
 * previous screen, which reads as the app being broken rather than busy.
 *
 * These mirror the real layout closely enough that the swap is not jarring —
 * a skeleton that resembles nothing is just a different kind of blank. The
 * blocks are flat glass (no blur: a skeleton is on screen for a moment and
 * there may be a dozen of them).
 */

function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />
}

export function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div aria-hidden>
      {/* Filter bar */}
      <div className="flex gap-2 px-4 pb-4 pt-4 sm:px-6">
        <Bar className="h-10 w-full max-w-72 rounded-full" />
        <Bar className="hidden h-10 w-32 rounded-full sm:block" />
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-2 px-4 sm:hidden">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="glass-tint rounded-2xl p-3.5">
            <Bar className="h-4 w-2/5" />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Bar className="h-3 w-4/5" />
              <Bar className="h-3 w-3/5" />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block">
        <div className="glass-tint mx-6 divide-y divide-glass-rim rounded-3xl">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Bar className="h-4 flex-1" />
              <Bar className="h-4 w-28" />
              <Bar className="hidden h-4 w-24 lg:block" />
              <Bar className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function StatGridSkeleton({ tiles = 4 }: { tiles?: number }) {
  return (
    <div
      className="grid gap-3 px-4 py-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4"
      aria-hidden
    >
      {Array.from({ length: tiles }).map((_, i) => (
        <div key={i} className="glass-tint rounded-3xl p-4">
          <Bar className="h-3 w-24" />
          <Bar className="mt-2.5 h-7 w-20" />
        </div>
      ))}
    </div>
  )
}

export function DetailSkeleton() {
  return (
    <div aria-hidden>
      <StatGridSkeleton />
      <div className="space-y-2 px-4 sm:px-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <Bar key={i} className="h-12 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

/** The heading block, so the page frame appears immediately. */
export function HeaderSkeleton() {
  return (
    <div className="border-b border-glass-rim px-4 py-4 sm:px-6 sm:py-5" aria-hidden>
      <Bar className="h-6 w-40" />
      <Bar className="mt-2 h-3.5 w-64" />
    </div>
  )
}

export function FormSkeleton({ sections = 3 }: { sections?: number }) {
  return (
    <div aria-hidden className="max-w-2xl space-y-5 px-4 py-4 sm:px-6">
      {Array.from({ length: sections }).map((_, i) => (
        <div key={i} className="glass-tint space-y-4 rounded-3xl p-4 sm:p-5">
          <Bar className="h-5 w-36" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Bar className="h-10 w-full rounded-xl" />
            <Bar className="h-10 w-full rounded-xl" />
          </div>
        </div>
      ))}
      <div className="flex gap-2.5">
        <Bar className="h-11 w-32 rounded-full" />
        <Bar className="h-11 w-36 rounded-full" />
      </div>
    </div>
  )
}

export function AttendanceSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div aria-hidden className="px-4 py-4 sm:px-6 space-y-3">
      <div className="flex gap-2">
        <Bar className="h-8 w-28 rounded-full" />
        <Bar className="h-8 w-28 rounded-full" />
      </div>
      <div className="glass-tint divide-y divide-glass-rim overflow-hidden rounded-3xl">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Bar className="size-6 rounded-full" />
            <Bar className="h-4 flex-1" />
            <Bar className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
