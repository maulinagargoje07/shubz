import { ShieldCheck, TriangleAlert } from "lucide-react"

import { DataTable, type Column } from "@/components/data-table/table"
import { FilterBar } from "@/components/data-table/filters"
import { PageHeader } from "@/components/page-header"
import { EmptyState, StatusPill, type StatusTone } from "@/components/ui/status"
import { formatDate } from "@/lib/fy"
import { ROLES, ROLE_LABELS, type Permission, type Role } from "@/lib/permissions"
import { requirePermissionPage } from "@/lib/session"
import { teamListParamsSchema } from "@/lib/validation/team"
import { listTeamMembers, type TeamMemberRow } from "@/server/team/queries"
import {
  AddTeamMemberDialog,
  EditTeamMemberDialog,
  ResetPasswordDialog,
  ToggleStatusButton,
} from "./team-dialogs"

export const dynamic = "force-dynamic"
export const metadata = { title: "Team" }

/** Privilege reads at a glance: root account, then descending. */
function roleTone(role: Role): StatusTone {
  switch (role) {
    case "SUPERADMIN":
      return "info"
    case "ADMIN":
      return "paid"
    case "MANAGER":
      return "pending"
    default:
      return "muted"
  }
}

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // The authorisation boundary for this whole screen. Hiding the nav link is
  // presentation; this is what actually stops a non-superadmin reading the
  // team list by typing the URL.
  const actor = await requirePermissionPage("MANAGE_USERS")

  const raw = await searchParams
  const str = (v: string | string[] | undefined) =>
    typeof v === "string" && v !== "" ? v : undefined

  const params = teamListParamsSchema.parse({
    q: str(raw.q),
    role: str(raw.role),
    status: str(raw.status),
  })

  const members = await listTeamMembers(params)

  const columns: Column<TeamMemberRow>[] = [
    {
      id: "name",
      header: "Name",
      priority: "primary",
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">
            {row.name}
            {row.id === actor.id ? (
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">you</span>
            ) : null}
          </p>
          <p className="truncate text-xs text-muted-foreground">{row.email}</p>
        </div>
      ),
    },
    {
      id: "role",
      header: "Role",
      priority: "primary",
      hideLabelOnCard: true,
      cell: (row) => (
        <StatusPill tone={roleTone(row.role)}>{ROLE_LABELS[row.role]}</StatusPill>
      ),
    },
    {
      id: "status",
      header: "Status",
      priority: "secondary",
      hideLabelOnCard: true,
      cell: (row) =>
        row.active ? (
          <StatusPill tone="paid">Active</StatusPill>
        ) : (
          <StatusPill tone="overdue">Deactivated</StatusPill>
        ),
    },
    {
      id: "permissions",
      header: "Permissions",
      priority: "secondary",
      cell: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.role === "SUPERADMIN"
            ? "All"
            : row.overrides === null
              ? `Role defaults · ${row.permissions.length}`
              : `Custom · ${row.permissions.length}`}
        </span>
      ),
    },
    {
      id: "created",
      header: "Added",
      priority: "tertiary",
      align: "right",
      cell: (row) => (
        <span className="text-muted-foreground">{formatDate(row.createdAt)}</span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      priority: "primary",
      align: "right",
      hideLabelOnCard: true,
      cell: (row) => (
        <div className="flex items-center justify-end gap-0.5">
          <EditTeamMemberDialog
            actorRole={actor.role}
            isSelf={row.id === actor.id}
            member={{
              id: row.id,
              name: row.name,
              email: row.email,
              role: row.role,
              overrides: row.overrides as Permission[] | null,
            }}
          />
          <ResetPasswordDialog member={{ id: row.id, name: row.name }} />
          <ToggleStatusButton
            member={{ id: row.id, name: row.name, active: row.active }}
            isSelf={row.id === actor.id}
          />
        </div>
      ),
    },
  ]

  const withoutPassword = members.filter((m) => !m.hasPassword)

  return (
    <div className="pb-8">
      <PageHeader
        title="Team"
        description="Who can sign in, and what each of them is allowed to do."
        actions={<AddTeamMemberDialog actorRole={actor.role} />}
      />

      <div className="px-4 pt-4 sm:px-6">
        <div className="flex items-start gap-2.5 rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <p className="text-muted-foreground">
            Role and permissions are read from the database on every request, so a
            change to someone&apos;s access takes effect on their next page load —
            they do not need to sign out and back in.
          </p>
        </div>
      </div>

      {withoutPassword.length > 0 ? (
        <div className="px-4 pt-3 sm:px-6">
          <div className="flex items-start gap-2.5 rounded-xl border border-pending/30 bg-pending-muted px-4 py-3 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-pending" aria-hidden />
            <p className="text-pending-foreground">
              {withoutPassword.map((m) => m.name).join(", ")}{" "}
              {withoutPassword.length === 1 ? "has" : "have"} no password set and
              cannot sign in. Use the key icon to give them one.
            </p>
          </div>
        </div>
      ) : null}

      <div className="pt-4">
        <FilterBar
          action="/settings/team"
          params={{ q: params.q || undefined, role: params.role, status: params.status }}
          searchPlaceholder="Search name or email"
          filters={[
            {
              key: "role",
              label: "Roles",
              options: ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] })),
            },
            {
              key: "status",
              label: "Statuses",
              options: [
                { value: "active", label: "Active" },
                { value: "inactive", label: "Deactivated" },
              ],
            },
          ]}
        />
      </div>

      {members.length === 0 ? (
        <div className="px-4 sm:px-6">
          <EmptyState
            title="Nobody matches those filters"
            description="Clear the filters, or add a new team member."
          />
        </div>
      ) : (
        <DataTable columns={columns} rows={members} rowKey={(row) => row.id} />
      )}
    </div>
  )
}
