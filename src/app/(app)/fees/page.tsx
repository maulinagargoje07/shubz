import Link from "next/link"
import { AlertTriangle, CheckCircle2 } from "lucide-react"

import { EmptyState, StatTile, StatusPill } from "@/components/ui/status"
import { DataTable, type Column } from "@/components/data-table/table"
import { PageHeader, SectionHeading } from "@/components/page-header"
import { requirePermissionPage } from "@/lib/session"
import { formatDate } from "@/lib/fy"
import { formatINR, formatINRShort } from "@/lib/money"
import { formatE164 } from "@/lib/phone-format"
import { programKindLabelOf } from "@/lib/programs"
import {
  collectedThisMonth,
  collectionByProgram,
  listOverdue,
  outstandingByProgram,
  overdueCount,
  totalOutstanding,
} from "@/server/fees/queries"
import type { DeliveryMode, ProgramType } from "@/db/schema"

export const dynamic = "force-dynamic"
export const metadata = { title: "Fees" }

type OverdueRow = {
  enrollmentId: string
  contactName: string
  contactPhone: string
  programName: string
  programType: ProgramType
  deliveryMode: DeliveryMode
  batchName: string | null
  balanceDuePaise: number
  daysOverdue: number
  nextDueDate: string | null
}

const overdueColumns: Column<OverdueRow>[] = [
  {
    id: "student",
    header: "Student",
    priority: "primary",
    cell: (row) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{row.contactName}</p>
        <p className="truncate text-xs text-muted-foreground tabular-nums">
          {formatE164(row.contactPhone)}
        </p>
      </div>
    ),
  },
  {
    id: "overdue",
    header: "Overdue",
    priority: "primary",
    align: "right",
    hideLabelOnCard: true,
    cell: (row) => <StatusPill tone="overdue">{row.daysOverdue} days</StatusPill>,
  },
  {
    id: "balance",
    header: "Balance",
    priority: "secondary",
    align: "right",
    cell: (row) => (
      <span className="font-medium tabular-nums">
        {formatINR(Math.max(Number(row.balanceDuePaise), 0))}
      </span>
    ),
  },
  {
    id: "program",
    header: "Program",
    priority: "secondary",
    cell: (row) => (
      <div className="min-w-0">
        <p className="truncate">{row.programName}</p>
        <p className="truncate text-xs text-muted-foreground">
          {programKindLabelOf(row.programType, row.deliveryMode)}
          {row.batchName ? ` · ${row.batchName}` : ""}
        </p>
      </div>
    ),
  },
  {
    id: "since",
    header: "Due since",
    priority: "tertiary",
    align: "right",
    cell: (row) => (
      <span className="text-muted-foreground">
        {row.nextDueDate ? formatDate(row.nextDueDate) : "—"}
      </span>
    ),
  },
]

export default async function FeesPage() {
  // Revenue is not front-desk information.
  await requirePermissionPage("VIEW_FINANCIALS")

  const [collected, outstanding, overdue, overdueRows, byProgram, outstandingSplit] =
    await Promise.all([
      collectedThisMonth(),
      totalOutstanding(),
      overdueCount(),
      listOverdue(),
      collectionByProgram(),
      outstandingByProgram(),
    ])

  return (
    <div className="pb-8">
      <PageHeader
        title="Fees"
        description="Every figure is computed from the payments ledger, not stored."
      />

      <div className="grid gap-3 px-4 py-4 sm:grid-cols-3 sm:px-6">
        <StatTile label="Collected this month" value={formatINRShort(collected)} />
        <StatTile label="Total outstanding" value={formatINRShort(outstanding)} />
        <StatTile
          label="Overdue enrollments"
          value={overdue}
          tone={overdue > 0 ? "overdue" : "paid"}
        />
      </div>

      <section className="mt-2">
        <div className="px-4 sm:px-6">
          <SectionHeading>Overdue — longest first</SectionHeading>
        </div>

        {overdueRows.length === 0 ? (
          <div className="px-4 sm:px-6">
            <EmptyState
              icon={<CheckCircle2 className="size-5 text-paid" />}
              title="Nothing overdue"
              description="Every enrollment is up to date on its schedule."
            />
          </div>
        ) : (
          <DataTable
            columns={overdueColumns}
            rows={overdueRows as unknown as OverdueRow[]}
            rowKey={(row) => row.enrollmentId}
            rowHref={(row) => `/enrollments/${row.enrollmentId}`}
          />
        )}
      </section>

      <section className="mt-8 px-4 sm:px-6">
        <SectionHeading>By program</SectionHeading>

        <div className="scroll-x overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <Th>Program</Th>
                <Th className="text-right">This month</Th>
                <Th className="hidden text-right sm:table-cell">All time</Th>
                <Th className="text-right">Outstanding</Th>
                <Th className="hidden text-right sm:table-cell">Overdue</Th>
              </tr>
            </thead>
            <tbody>
              {byProgram.map((row) => {
                const owed = outstandingSplit.find((o) => o.programId === row.programId)
                return (
                  <tr key={row.programId} className="border-b last:border-0 hover:bg-accent/40">
                    <td className="px-4 py-2.5">
                      <Link href={`/programs/${row.programId}`} className="hover:underline">
                        <span className="block truncate">{row.programName}</span>
                      </Link>
                      <span className="block truncate text-xs text-muted-foreground">
                        {programKindLabelOf(row.programType, row.deliveryMode)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatINR(Number(row.collectedThisMonthPaise))}
                    </td>
                    <td className="hidden px-4 py-2.5 text-right tabular-nums text-muted-foreground sm:table-cell">
                      {formatINR(Number(row.collectedAllTimePaise))}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatINR(Number(owed?.outstandingPaise ?? 0))}
                    </td>
                    <td className="hidden px-4 py-2.5 text-right sm:table-cell">
                      {owed?.overdueCount ? (
                        <span className="inline-flex items-center gap-1 text-overdue">
                          <AlertTriangle className="size-3.5" aria-hidden />
                          <span className="tabular-nums">{owed.overdueCount}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={`px-4 py-2.5 text-left text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground ${className}`}
    >
      {children}
    </th>
  )
}
