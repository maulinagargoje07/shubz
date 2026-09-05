import { notFound } from "next/navigation"

import { PageHeader } from "@/components/page-header"
import { getProgram } from "@/server/programs/queries"
import { ProgramForm } from "../../program-form"

export const dynamic = "force-dynamic"
export const metadata = { title: "Edit program" }

export default async function EditProgramPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const program = await getProgram(id)
  if (!program) notFound()

  return (
    <div>
      <PageHeader title={`Edit ${program.name}`} />
      <ProgramForm program={program} />
    </div>
  )
}
