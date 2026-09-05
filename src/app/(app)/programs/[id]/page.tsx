import Link from "next/link"
import { notFound } from "next/navigation"
import { MapPin, Pencil, Plus, Video } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/page-header"
import { formatDate } from "@/lib/fy"
import { formatINRShort } from "@/lib/money"
import { BATCH_STATUS_LABELS, PROGRAM_STATUS_LABELS } from "@/lib/labels"
import { billingCycleLabel, programKindLabel } from "@/lib/programs"
import { listBatchesForProgram } from "@/server/batches/queries"
import { getProgram } from "@/server/programs/queries"

export const dynamic = "force-dynamic"

export default async function ProgramDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const program = await getProgram(id)
  if (!program) notFound()

  const batches = await listBatchesForProgram(id)
  const isOnline = program.deliveryMode === "ONLINE"

  return (
    <div>
      <PageHeader
        title={program.name}
        description={`${programKindLabel(program)} · ${program.code}`}
        actions={
          <>
            <Button variant="outline" render={<Link href={`/programs/${id}/edit`} />}>
              <Pencil className="size-4" />
              Edit
            </Button>
            <Button render={<Link href={`/programs/${id}/batches/new`} />}>
              <Plus className="size-4" />
              New batch
            </Button>
          </>
        }
      />

      <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Default fee">
          {formatINRShort(program.defaultFeePaise)}
          {program.defaultBillingType === "RECURRING" && program.defaultBillingCycle ? (
            <span className="text-sm font-normal text-muted-foreground">
              {" "}
              / {billingCycleLabel(program.defaultBillingCycle).toLowerCase()}
            </span>
          ) : null}
        </Stat>
        <Stat label="Billing">
          {program.defaultBillingType === "RECURRING" ? "Recurring" : "One-time"}
        </Stat>
        <Stat label="Delivery">
          <span className="inline-flex items-center gap-1.5">
            {isOnline ? <Video className="size-4" /> : <MapPin className="size-4" />}
            {isOnline ? "Online" : "Offline"}
          </span>
        </Stat>
        <Stat label="Status">
          {PROGRAM_STATUS_LABELS[program.status] ?? program.status}
        </Stat>
      </div>

      {program.description ? (
        <p className="px-6 pb-6 text-sm text-muted-foreground">{program.description}</p>
      ) : null}

      <div className="px-6 pb-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Batches
        </h2>

        {batches.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No batches yet.{" "}
              <Link href={`/programs/${id}/batches/new`} className="underline">
                Create the first one
              </Link>
              .
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {batches.map((batch) => (
              <Card key={batch.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">
                      <Link
                        href={`/programs/${id}/batches/${batch.id}`}
                        className="hover:underline"
                      >
                        {batch.name}
                      </Link>
                    </CardTitle>
                    <Badge variant="secondary">
                      {BATCH_STATUS_LABELS[batch.status] ?? batch.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1.5 text-sm text-muted-foreground">
                  <p>{batch.code}</p>
                  {batch.startDate ? (
                    <p>
                      {formatDate(batch.startDate)}
                      {batch.endDate ? ` – ${formatDate(batch.endDate)}` : ""}
                    </p>
                  ) : null}
                  {batch.timingText ? <p>{batch.timingText}</p> : null}

                  {/* Only the field that applies to this delivery mode is shown. */}
                  {isOnline ? (
                    batch.meetingLink ? (
                      <p className="flex items-center gap-1.5 truncate">
                        <Video className="size-3.5 shrink-0" />
                        <span className="truncate">{batch.meetingLink}</span>
                      </p>
                    ) : null
                  ) : batch.venueName ? (
                    <p className="flex items-center gap-1.5">
                      <MapPin className="size-3.5 shrink-0" />
                      {batch.venueName}
                    </p>
                  ) : null}

                  <p className="pt-1 text-foreground">
                    <span className="tabular-nums">{batch.participantCount}</span> participant
                    {batch.participantCount === 1 ? "" : "s"}
                    {batch.seatCapacity ? (
                      <span className="text-muted-foreground"> of {batch.seatCapacity} seats</span>
                    ) : batch.capacity ? (
                      <span className="text-muted-foreground"> of {batch.capacity}</span>
                    ) : null}
                    <span className="text-muted-foreground">
                      {" · "}
                      {batch.sessionCount} session{batch.sessionCount === 1 ? "" : "s"}
                    </span>
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{children}</p>
    </div>
  )
}
