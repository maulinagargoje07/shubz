import Link from "next/link"
import { Settings2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { requirePermissionPage } from "@/lib/session"
import { PageHeader } from "@/components/page-header"
import { listBatchLabels } from "@/server/records/resolve"
import { StudentRecordForm } from "../record-form"

export const dynamic = "force-dynamic"
export const metadata = { title: "New student record" }

export default async function NewRecordPage() {
  // Creating a student record.
  await requirePermissionPage("MANAGE_ENROLLMENTS")

  const batchLabels = await listBatchLabels()

  return (
    <div>
      <PageHeader
        back={{ href: "/enrollments", label: "Enrollments" }}
        title="New student record"
        description="Student, program and fees in one form."
        actions={
          <Button variant="outline" render={<Link href="/enrollments/new/advanced" />}>
            <Settings2 className="size-4" />
            Detailed form
          </Button>
        }
      />
      <StudentRecordForm batchLabels={batchLabels} />
    </div>
  )
}
