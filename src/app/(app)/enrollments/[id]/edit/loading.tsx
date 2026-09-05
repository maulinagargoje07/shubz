import { FormSkeleton, HeaderSkeleton } from "@/components/skeletons"

export default function Loading() {
  return (
    <div>
      <HeaderSkeleton />
      <FormSkeleton sections={3} />
    </div>
  )
}
