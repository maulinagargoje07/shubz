import Link from "next/link"
import { AlertTriangle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/page-header"
import { formatDate } from "@/lib/fy"
import { formatINR, formatINRShort } from "@/lib/money"
import { programKindLabelOf } from "@/lib/programs"
import { formatPhone } from "@/lib/phone"
import {
  collectedThisMonth,
  collectionByProgram,
  listOverdue,
  outstandingByProgram,
  overdueCount,
  totalOutstanding,
} from "@/server/fees/queries"

export const dynamic = "force-dynamic"
export const metadata = { title: "Fees" }

export default async function FeesPage() {
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
    <div>
      <PageHeader
        title="Fees"
        description="Every figure is computed from the payments ledger, not stored."
      />

      <div className="grid gap-4 p-6 sm:grid-cols-3">
        <Stat label="Collected this month" value={formatINRShort(collected)} />
        <Stat label="Total outstanding" value={formatINRShort(outstanding)} />
        <Stat
          label="Overdue enrollments"
          value={String(overdue)}
          tone={overdue > 0 ? "danger" : undefined}
        />
      </div>

      <section className="px-6 pb-8">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          {overdueRows.length > 0 ? (
            <AlertTriangle className="size-4 text-rose-500" />
          ) : null}
          Overdue — longest first
        </h2>

        {overdueRows.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Nothing overdue. Everyone is up to date.
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  <Th>Student</Th>
                  <Th>Program</Th>
                  <Th className="text-right">Due since</Th>
                  <Th className="text-right">Overdue</Th>
                  <Th className="text-right">Balance</Th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {overdueRows.map((row) => (
                  <tr key={row.enrollmentId} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/enrollments/${row.enrollmentId}`}
                        className="font-medium hover:underline"
                      >
                        {row.contactName}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {formatPhone(row.contactPhone)}
                      </p>
                    </td>
                    <td className="px-4 py-2.5">
                      {row.programName}
                      <p className="text-xs text-muted-foreground">
                        {programKindLabelOf(row.programType, row.deliveryMode)}
                        {row.batchName ? ` · ${row.batchName}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">
                      {row.nextDueDate ? formatDate(row.nextDueDate) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Badge
                        variant="secondary"
                        className="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200"
                      >
                        {row.daysOverdue}d
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                      {formatINR(Math.max(Number(row.balanceDuePaise), 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="px-6 pb-10">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          By program
        </h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr>
                <Th>Program</Th>
                <Th className="text-right">This month</Th>
                <Th className="text-right">All time</Th>
                <Th className="text-right">Outstanding</Th>
                <Th className="text-right">Overdue</Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {byProgram.map((row) => {
                const owed = outstandingSplit.find((o) => o.programId === row.programId)
                return (
                  <tr key={row.programId} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5">
                      <Link href={`/programs/${row.programId}`} className="hover:underline">
                        {row.programName}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {programKindLabelOf(row.programType, row.deliveryMode)}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatINR(Number(row.collectedThisMonthPaise))}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {formatINR(Number(row.collectedAllTimePaise))}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatINR(Number(owed?.outstandingPaise ?? 0))}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {owed?.overdueCount ? (
                        <span className="text-rose-600 dark:text-rose-400">
                          {owed.overdueCount}
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

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: "danger"
}) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          tone === "danger" ? "text-rose-600 dark:text-rose-400" : ""
        }`}
      >
        {value}
      </p>
    </div>
  )
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-2.5 text-xs font-medium uppercase tracking-wide ${className}`}>
      {children}
    </th>
  )
}
