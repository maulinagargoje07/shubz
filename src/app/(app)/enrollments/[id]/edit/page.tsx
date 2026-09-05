import { notFound } from "next/navigation"

import { PageHeader } from "@/components/page-header"
import { db } from "@/db"
import { batches } from "@/db/schema"
import { searchContactsForPicker } from "@/server/contacts/queries"
import { getEnrollmentRaw } from "@/server/enrollments/queries"
import { listSelectablePrograms } from "@/server/programs/queries"
import { EnrollmentForm } from "../../enrollment-form"

export const dynamic = "force-dynamic"
export const metadata = { title: "Edit enrollment" }

export default async function EditEnrollmentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const enrollment = await getEnrollmentRaw(id)
  if (!enrollment) notFound()

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
      <PageHeader title="Edit enrollment" />
      <EnrollmentForm
        contacts={contacts}
        programs={programs}
        batches={allBatches}
        enrollment={enrollment}
      />
    </div>
  )
}
