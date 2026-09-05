import { notFound } from "next/navigation"

import { PageHeader } from "@/components/page-header"
import { db } from "@/db"
import { batches, programs } from "@/db/schema"
import { eq } from "drizzle-orm"
import { toProgramKind } from "@/lib/programs"
import { getEnrollment, getEnrollmentRaw } from "@/server/enrollments/queries"
import { listBatchLabels } from "@/server/records/resolve"
import { StudentRecordEditForm } from "../../record-edit-form"
import type { RecordProgramKind } from "@/lib/validation/record"

export const dynamic = "force-dynamic"
export const metadata = { title: "Edit record" }

export default async function EditRecordPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [raw, view] = await Promise.all([getEnrollmentRaw(id), getEnrollment(id)])
  if (!raw || !view) notFound()

  const [program] = await db
    .select({ type: programs.type, deliveryMode: programs.deliveryMode })
    .from(programs)
    .where(eq(programs.id, raw.programId))
    .limit(1)

  const batch = raw.batchId
    ? await db
        .select({ name: batches.name })
        .from(batches)
        .where(eq(batches.id, raw.batchId))
        .limit(1)
    : []

  const batchLabels = await listBatchLabels()

  return (
    <div>
      <PageHeader
        back={{ href: `/enrollments/${id}`, label: "Record" }}
        title="Edit record"
        description={String(view.contactName)}
      />
      <StudentRecordEditForm
        batchLabels={batchLabels}
        paidPaise={Number(view.totalPaidPaise)}
        record={{
          id,
          fullName: String(view.contactName),
          phone: String(view.contactPhone),
          email: (view.contactEmail as string | null) ?? null,
          city: null,
          programKind: toProgramKind(
            program?.type ?? "MENTORSHIP",
            program?.deliveryMode ?? "ONLINE"
          ) as RecordProgramKind,
          batchLabel: batch[0]?.name ?? null,
          totalFeesPaise: raw.feeTotalPaise,
          enrolledOn: raw.enrolledOn,
          status: raw.status,
          notes: raw.notes,
        }}
      />
    </div>
  )
}
