import Link from "next/link"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { listPrograms } from "@/server/programs/queries"
import { ProgramsTable } from "./programs-table"

export const dynamic = "force-dynamic"
export const metadata = { title: "Programs" }

export default async function ProgramsPage() {
  const rows = await listPrograms()

  return (
    <div>
      <PageHeader
        title="Programs"
        description="Mentorship, Trading Floor, webinars and workshops."
        actions={
          <Button render={<Link href="/programs/new" />}>
            <Plus className="size-4" />
            New program
          </Button>
        }
      />
      <ProgramsTable rows={rows} />
    </div>
  )
}
