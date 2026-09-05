import { PageHeader } from "@/components/page-header"
import { searchContactsForPicker } from "@/server/contacts/queries"
import { listSelectablePrograms } from "@/server/programs/queries"
import { db } from "@/db"
import { batches } from "@/db/schema"
import { EnrollmentForm } from "../enrollment-form"

export const dynamic = "force-dynamic"
export const metadata = { title: "New enrollment" }

export default async function NewEnrollmentPage() {
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
        title="New enrollment"
        description="Pick a student and a program; the fee plan is generated from what you enter."
      />
      <EnrollmentForm contacts={contacts} programs={programs} batches={allBatches} />
    </div>
  )
}
