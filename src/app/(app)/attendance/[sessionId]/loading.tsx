import { AttendanceSkeleton, HeaderSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <div>
      <HeaderSkeleton />
      <AttendanceSkeleton />
    </div>
  )
}
