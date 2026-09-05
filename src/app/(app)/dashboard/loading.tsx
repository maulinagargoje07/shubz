import { HeaderSkeleton, ListSkeleton, StatGridSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <div>
      <HeaderSkeleton />
      <StatGridSkeleton />
      <div className="px-4 sm:px-6">
        <ListSkeleton rows={4} />
      </div>
    </div>
  )
}
