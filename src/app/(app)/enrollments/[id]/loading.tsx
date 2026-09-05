import { DetailSkeleton, HeaderSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <div>
      <HeaderSkeleton />
      <DetailSkeleton />
    </div>
  )
}
