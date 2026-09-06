import Link from "next/link"
import { notFound } from "next/navigation"
import { CalendarDays, MapPin, Pencil, Plus, Users, Video } from "lucide-react"

import { Button } from "@/components/ui/button"
import { EmptyState, StatTile, StatusPill } from "@/components/ui/status"
import { PageHeader, SectionHeading } from "@/components/page-header"
import { requireUser } from "@/lib/session"
import { can } from "@/lib/permissions"
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
  const viewer = await requireUser()
  const showMoney = can(viewer, "VIEW_FINANCIALS")

  const { id } = await params
  const program = await getProgram(id)
  if (!program) notFound()

  const batches = await listBatchesForProgram(id)
  const isOnline = program.deliveryMode === "ONLINE"

  return (
    <div className="pb-8">
      <PageHeader
        back={{ href: "/programs", label: "Programs" }}
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

      <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        {showMoney ? (
        <StatTile
          label="Default fee"
          value={formatINRShort(program.defaultFeePaise)}
          hint={
            program.defaultBillingType === "RECURRING" && program.defaultBillingCycle
              ? `Per ${billingCycleLabel(program.defaultBillingCycle).toLowerCase()}`
              : "One-time"
          }
        />
        ) : null}
        <StatTile
          label="Delivery"
          value={isOnline ? "Online" : "Offline"}
          icon={isOnline ? <Video className="size-3.5" /> : <MapPin className="size-3.5" />}
          hint={isOnline ? "Batches need a meeting link" : "Batches need a venue"}
        />
        <StatTile label="Batches" value={batches.length} />
        <StatTile
          label="Status"
          value={PROGRAM_STATUS_LABELS[program.status] ?? program.status}
        />
      </div>

      {program.description ? (
        <p className="px-4 pb-4 text-sm text-muted-foreground sm:px-6">
          {program.description}
        </p>
      ) : null}

      <section className="px-4 sm:px-6">
        <SectionHeading>Batches</SectionHeading>

        {batches.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="size-5" />}
            title="No batches yet"
            description={
              isOnline
                ? "A batch groups students and sessions. This one will ask for a meeting link."
                : "A batch groups students and sessions. This one will ask for a venue."
            }
            action={
              <Button render={<Link href={`/programs/${id}/batches/new`} />}>
                Create the first batch
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {batches.map((batch) => (
              <Link
                key={batch.id}
                href={`/programs/${id}/batches/${batch.id}`}
                className="rounded-xl border bg-card p-4 transition-colors hover:bg-accent/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 truncate font-medium">{batch.name}</p>
                  <StatusPill tone={batch.status === "RUNNING" ? "paid" : "neutral"}>
                    {BATCH_STATUS_LABELS[batch.status] ?? batch.status}
                  </StatusPill>
                </div>

                <p className="mt-0.5 text-xs text-muted-foreground">{batch.code}</p>

                <dl className="mt-3 space-y-1 text-sm text-muted-foreground">
                  {batch.startDate ? (
                    <div className="flex items-center gap-1.5">
                      <CalendarDays className="size-3.5 shrink-0" aria-hidden />
                      {formatDate(batch.startDate)}
                      {batch.endDate ? ` – ${formatDate(batch.endDate)}` : ""}
                    </div>
                  ) : null}

                  {/* Only the field that applies to this delivery mode. */}
                  {isOnline
                    ? batch.meetingLink && (
                        <div className="flex items-center gap-1.5">
                          <Video className="size-3.5 shrink-0" aria-hidden />
                          <span className="truncate">Meeting link set</span>
                        </div>
                      )
                    : batch.venueName && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="size-3.5 shrink-0" aria-hidden />
                          <span className="truncate">{batch.venueName}</span>
                        </div>
                      )}

                  <div className="flex items-center gap-1.5 text-foreground">
                    <Users className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="tabular-nums">{batch.participantCount}</span>
                    <span className="text-muted-foreground">
                      {batch.seatCapacity
                        ? `of ${batch.seatCapacity} seats`
                        : batch.capacity
                          ? `of ${batch.capacity}`
                          : batch.participantCount === 1
                            ? "participant"
                            : "participants"}
                      {" · "}
                      {batch.sessionCount} session{batch.sessionCount === 1 ? "" : "s"}
                    </span>
                  </div>
                </dl>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
