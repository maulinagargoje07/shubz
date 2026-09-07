import Link from "next/link"
import { Upload, UserPlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { EmptyState, StatTile, StatusPill } from "@/components/ui/status"
import { SubLabel } from "@/components/ui/sub-label"
import { DataTable, type Column } from "@/components/data-table/table"
import { FilterBar, Pagination } from "@/components/data-table/filters"
import { PageHeader } from "@/components/page-header"
import { formatIST } from "@/lib/fy"
import { SOURCE_LABELS } from "@/lib/labels"
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_TONES,
  type LeadStatus,
} from "@/lib/leads"
import { enumParam, idParam, pageParam, textParam } from "@/lib/search-params"
import { requirePermissionPage } from "@/lib/session"
import {
  leadExperienceOptions,
  leadListOptions,
  leadStats,
  listLeads,
} from "@/server/leads/queries"
import { LeadBulkActions } from "./lead-bulk-actions"
import { LeadStatusPicker } from "./lead-status-picker"

export const dynamic = "force-dynamic"
export const metadata = { title: "Leads" }

type Row = {
  id: string
  fullName: string
  phoneE164: string
  email: string | null
  city: string | null
  source: string
  leadStatus: LeadStatus
  lifecycleStage: string
  tradingExperience: string | null
  leadCapturedAt: Date | null
  createdAt: Date
  lists: string[]
}

const columns: Column<Row>[] = [
  {
    id: "lead",
    header: "Lead",
    priority: "primary",
    cell: (row) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{row.fullName}</p>
        <SubLabel parts={[row.phoneE164, row.city]} />
      </div>
    ),
  },
  {
    id: "experience",
    header: "Experience",
    priority: "secondary",
    cell: (row) =>
      row.tradingExperience ? (
        <span className="block max-w-56 truncate text-sm">{row.tradingExperience}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: "source",
    header: "Source",
    priority: "tertiary",
    cell: (row) => (
      <span className="text-sm text-muted-foreground">
        {SOURCE_LABELS[row.source as keyof typeof SOURCE_LABELS] ?? row.source}
      </span>
    ),
  },
  {
    id: "lists",
    header: "Lists",
    priority: "tertiary",
    cell: (row) =>
      row.lists.length === 0 ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        <div className="flex flex-wrap gap-1">
          {row.lists.slice(0, 2).map((name) => (
            <StatusPill key={name} tone="info">
              {name}
            </StatusPill>
          ))}
          {row.lists.length > 2 ? (
            <span className="text-xs text-muted-foreground">
              +{row.lists.length - 2}
            </span>
          ) : null}
        </div>
      ),
  },
  {
    id: "captured",
    header: "Captured",
    priority: "secondary",
    cell: (row) => (
      <span className="whitespace-nowrap text-sm text-muted-foreground">
        {row.leadCapturedAt
          ? formatIST(row.leadCapturedAt, "d MMM yyyy")
          : /*
             * Nothing was imported for this lead, so say where the date came
             * from rather than showing a capture date that is really just the
             * day somebody typed them in.
             */
            `Added ${formatIST(row.createdAt, "d MMM yyyy")}`}
      </span>
    ),
  },
  {
    id: "status",
    header: "Status",
    priority: "primary",
    cell: (row) => (
      <StatusPill tone={LEAD_STATUS_TONES[row.leadStatus] ?? "neutral"}>
        {LEAD_STATUS_LABELS[row.leadStatus] ?? row.leadStatus}
      </StatusPill>
    ),
  },
  {
    id: "actions",
    header: "",
    priority: "primary",
    cell: (row) => <LeadStatusPicker contactId={row.id} status={row.leadStatus} />,
  },
]

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requirePermissionPage("MANAGE_CONTACTS")

  const raw = await searchParams
  const page = pageParam(raw.page)
  const perPage = 25

  const active = {
    q: textParam(raw.q),
    status: enumParam(raw.status, LEAD_STATUSES),
    source: enumParam(raw.source, Object.keys(SOURCE_LABELS)),
    list: idParam(raw.list),
    experience: textParam(raw.experience),
    from: textParam(raw.from),
    to: textParam(raw.to),
    converted: textParam(raw.converted),
  }

  const filters = {
    q: active.q,
    status: active.status,
    source: active.source,
    list: active.list,
    experience: active.experience,
    from: active.from,
    to: active.to,
    includeConverted: active.converted === "1",
  }

  const [{ rows, total }, stats, lists, experiences] = await Promise.all([
    listLeads({ ...filters, page, perPage }),
    leadStats(),
    leadListOptions(),
    leadExperienceOptions(),
  ])

  const hasFilters = Boolean(
    active.q ||
      active.status ||
      active.source ||
      active.list ||
      active.experience ||
      active.from ||
      active.to
  )

  const exportQuery = new URLSearchParams(
    Object.entries(active).filter(([, v]) => Boolean(v)) as [string, string][]
  ).toString()

  return (
    <div className="pb-8">
      <PageHeader
        title="Leads"
        description="Everyone who has shown interest but not enrolled yet. Import a sheet, work the list, then hand a segment to a campaign."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" render={<Link href="/contacts/new" />}>
              <UserPlus className="size-4" />
              Add one
            </Button>
            <Button render={<Link href="/imports" />}>
              <Upload className="size-4" />
              Import leads
            </Button>
          </div>
        }
      />

      {/*
        The tiles describe the whole pipeline, not the filtered view, and each
        one is a link that applies its own filter — the number and the way to
        act on it are the same control.
      */}
      <div className="grid grid-cols-2 gap-3 px-4 py-4 sm:grid-cols-3 sm:px-6 lg:grid-cols-5">
        <StatTile label="Open leads" value={stats.total} href="/leads" />
        <StatTile label="New" value={stats.new} href="/leads?status=NEW" />
        <StatTile label="Contacted" value={stats.contacted} href="/leads?status=CONTACTED" />
        <StatTile label="Interested" value={stats.interested} href="/leads?status=INTERESTED" />
        <StatTile
          label="Converted"
          value={stats.converted}
          tone="paid"
          href="/leads?status=CONVERTED&converted=1"
        />
      </div>

      <FilterBar
        action="/leads"
        params={active}
        searchPlaceholder="Search name, phone or email"
        filters={[
          {
            key: "status",
            label: "Statuses",
            options: LEAD_STATUSES.map((s) => ({
              value: s,
              label: LEAD_STATUS_LABELS[s],
            })),
          },
          {
            key: "source",
            label: "Sources",
            options: Object.entries(SOURCE_LABELS).map(([value, label]) => ({
              value,
              label,
            })),
          },
          {
            key: "list",
            label: "Lists",
            options: lists.map((l) => ({
              value: l.value,
              label: `${l.label} (${l.count})`,
            })),
          },
          {
            key: "experience",
            label: "Experience",
            options: experiences.map((e) => ({
              value: e.value,
              label: `${e.value} (${e.count})`,
            })),
          },
        ]}
      >
        {/*
          Capture-date bounds and the converted toggle are plain inputs inside
          the same GET form, so they submit with everything else and survive in
          the URL like every other filter.
        */}
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-0">
            <span className="mb-1 block text-xs text-muted-foreground">Captured from</span>
            <input
              type="date"
              name="from"
              defaultValue={active.from ?? ""}
              className="h-10 w-full rounded-lg border border-border/80 bg-card px-3 text-sm outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20"
            />
          </label>
          <label className="min-w-0">
            <span className="mb-1 block text-xs text-muted-foreground">to</span>
            <input
              type="date"
              name="to"
              defaultValue={active.to ?? ""}
              className="h-10 w-full rounded-lg border border-border/80 bg-card px-3 text-sm outline-none focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20"
            />
          </label>
          <label className="flex h-10 items-center gap-2 rounded-lg border border-border/80 bg-card px-3 text-sm">
            <input
              type="checkbox"
              name="converted"
              value="1"
              defaultChecked={filters.includeConverted}
              className="size-4 accent-primary"
            />
            Include converted
          </label>
        </div>
      </FilterBar>

      {total > 0 ? (
        <div className="px-4 sm:px-6">
          <LeadBulkActions
            filters={filters}
            count={total}
            filtered={hasFilters}
            exportHref={`/leads/export${exportQuery ? `?${exportQuery}` : ""}`}
          />
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="px-4 sm:px-6">
          <EmptyState
            title={hasFilters ? "No leads match those filters" : "No leads yet"}
            description={
              hasFilters
                ? "Clear a filter or widen the date range."
                : "Import your registration sheet and every row becomes a lead you can work through and message."
            }
            action={
              <Button render={<Link href="/imports" />}>
                <Upload className="size-4" />
                Import leads
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={rows as Row[]}
            rowKey={(row) => row.id}
            rowHref={(row) => `/contacts/${row.id}`}
          />
          <Pagination
            action="/leads"
            params={active}
            page={page}
            perPage={perPage}
            total={total}
          />
        </>
      )}
    </div>
  )
}
