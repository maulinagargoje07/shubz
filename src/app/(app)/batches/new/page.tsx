import Link from "next/link"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/status"
import { PageHeader } from "@/components/page-header"
import { requirePermissionPage } from "@/lib/session"
import { listSelectablePrograms } from "@/server/programs/queries"
import { BatchForm } from "../../programs/[id]/batches/batch-form"

export const dynamic = "force-dynamic"
export const metadata = { title: "New batch" }

/**
 * Create a batch without first navigating into a program.
 *
 * The nested route under a program still exists and is the natural path when
 * you are already looking at one. This is the path for when you are not.
 */
export default async function NewBatchPage() {
  await requirePermissionPage("MANAGE_PROGRAMS")

  const programs = await listSelectablePrograms()

  if (programs.length === 0) {
    return (
      <div>
        <PageHeader back={{ href: "/batches", label: "Batches" }} title="New batch" />
        <div className="px-4 py-4 sm:px-6">
          <EmptyState
            title="No programs yet"
            description="A batch belongs to a program, so create the program first."
            action={<Button render={<Link href="/programs/new" />}>New program</Button>}
          />
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        back={{ href: "/batches", label: "Batches" }}
        title="New batch"
        description="Pick the program — it decides whether the batch needs a venue or a meeting link."
      />
      <BatchForm programs={programs} />
    </div>
  )
}
