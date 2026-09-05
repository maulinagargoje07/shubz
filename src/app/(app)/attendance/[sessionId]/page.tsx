import { notFound } from "next/navigation"

import { PageHeader } from "@/components/page-header"
import { formatIST } from "@/lib/fy"
import { programKindLabel } from "@/lib/programs"
import { getSessionRegister } from "@/server/attendance/queries"
import { getSessionWithContext } from "@/server/sessions/queries"
import { AttendanceRegister, type RegisterRow } from "./register"

export const dynamic = "force-dynamic"
export const metadata = { title: "Attendance" }

export default async function AttendanceSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params
  const context = await getSessionWithContext(sessionId)
  if (!context) notFound()

  const rows = await getSessionRegister(sessionId)

  return (
    <div className="pb-8">
      <PageHeader
        back={{ href: "/attendance", label: "Attendance" }}
        title={context.session.title}
        description={`${context.batch.name} · ${programKindLabel(context.program)} · ${formatIST(
          context.session.scheduledAt
        )}`}
      />
      <div className="pt-4">
        <AttendanceRegister
          sessionId={sessionId}
          deliveryMode={context.program.deliveryMode}
          rows={rows as RegisterRow[]}
        />
      </div>
    </div>
  )
}
