import { PageHeader } from "@/components/page-header"
import { ProgramForm } from "../program-form"

export const metadata = { title: "New program" }

export default function NewProgramPage() {
  return (
    <div>
      <PageHeader
        title="New program"
        description="Type and delivery mode are picked together, then drive what batches ask for."
      />
      <ProgramForm />
    </div>
  )
}
