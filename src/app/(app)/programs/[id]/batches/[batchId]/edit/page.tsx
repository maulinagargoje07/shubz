import { notFound } from "next/navigation"

import { PageHeader } from "@/components/page-header"
import { getBatchWithProgram } from "@/server/batches/queries"
import { BatchForm } from "../../batch-form"

export const dynamic = "force-dynamic"
export const metadata = { title: "Edit batch" }

export default async function EditBatchPage({
  params,
}: {
  params: Promise<{ batchId: string }>
}) {
  const { batchId } = await params
  const row = await getBatchWithProgram(batchId)
  if (!row) notFound()

  return (
    <div>
      <PageHeader title={`Edit ${row.batch.name}`} description={row.program.name} />
      <BatchForm program={row.program} batch={row.batch} />
    </div>
  )
}
