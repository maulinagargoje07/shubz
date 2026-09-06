import { requirePermissionPage } from "@/lib/session"
import { PageHeader } from "@/components/page-header"
import { searchContactsForPicker } from "@/server/contacts/queries"
import { listSelectablePrograms } from "@/server/programs/queries"
import { db } from "@/db"
import { batches } from "@/db/schema"
import { EnrollmentForm } from "../../enrollment-form"

export const dynamic = "force-dynamic"
export const metadata = { title: "Detailed enrollment" }

export default async function NewEnrollmentPage() {
  // Creating a student record.
  await requirePermissionPage("MANAGE_ENROLLMENTS")

  const [contacts, programs, allBatches] = await Promise.all([
    searchContactsForPicker("", 500),
    listSelectablePrograms(),
    db
      .select({
        id: batches.id,
        name: batches.name,
        code: batches.code,
        programId: batches.programId,
        seatCapacity: batches.seatCapacity,
      })
      .from(batches),
  ])

  return (
    <div>
      <PageHeader
        back={{ href: "/enrollments/new", label: "Quick record" }}
        title="Detailed enrollment"
        description="For recurring billing, installment plans, seat allocation, or enrolling an existing contact."
      />
      <EnrollmentForm contacts={contacts} programs={programs} batches={allBatches} />
    </div>
  )
}
