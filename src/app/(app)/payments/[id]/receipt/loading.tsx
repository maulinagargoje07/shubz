import { HeaderSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <div className="max-w-2xl px-4 py-8 sm:px-6">
      <HeaderSkeleton />
      <div className="mt-6 h-96 animate-pulse rounded-2xl border border-border/80 bg-card p-6" />
    </div>
  )
}
