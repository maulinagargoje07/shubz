import { notFound } from "next/navigation"

import { PageHeader } from "@/components/page-header"
import { getProgram } from "@/server/programs/queries"
import { BatchForm } from "../batch-form"

export const dynamic = "force-dynamic"
export const metadata = { title: "New batch" }

export default async function NewBatchPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const program = await getProgram(id)
  if (!program) notFound()

  return (
    <div>
      <PageHeader title="New batch" description={program.name} />
      <BatchForm program={program} />
    </div>
  )
}
