import { and, asc, eq, ilike, or, sql } from "drizzle-orm"

import { db } from "@/db"
import { accounts, users } from "@/db/schema"
import { effectivePermissions, isRole, type Permission, type Role } from "@/lib/permissions"
import type { TeamListParams } from "@/lib/validation/team"

export type TeamMemberRow = {
  id: string
  name: string
  email: string
  role: Role
  active: boolean
  /** Null when the user follows their role's defaults. */
  overrides: Permission[] | null
  /** Resolved rights, for the "what can they actually do" column. */
  permissions: Permission[]
  createdAt: Date
  /** False when no credential exists — the account cannot sign in yet. */
  hasPassword: boolean
}

export async function listTeamMembers(
  params: TeamListParams = { q: "" }
): Promise<TeamMemberRow[]> {
  const filters = []

  if (params.q) {
    const term = `%${params.q}%`
    filters.push(or(ilike(users.name, term), ilike(users.email, term))!)
  }
  if (params.role) filters.push(eq(users.role, params.role))
  if (params.status) filters.push(eq(users.active, params.status === "active"))

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      active: users.active,
      permissions: users.permissions,
      createdAt: users.createdAt,
      // A user row without a credential row can be created but never signed
      // into; surfacing that stops it looking like a broken password.
      hasPassword: sql<boolean>`exists (
        select 1 from account a
        where a.user_id = "user".id
          and a.provider_id = 'credential'
          and a.password is not null
      )`,
    })
    .from(users)
    .where(filters.length ? and(...filters) : undefined)
    // Superadmin first, then by role rank, then alphabetically — the enum is
    // declared in privilege order so it sorts correctly on its own.
    .orderBy(asc(users.role), asc(users.name))

  return rows.map((row) => {
    const role: Role = isRole(row.role) ? row.role : "OPERATOR"
    const overrides = row.permissions as Permission[] | null
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role,
      active: row.active,
      overrides,
      permissions: effectivePermissions(role, overrides),
      createdAt: row.createdAt,
      hasPassword: Boolean(row.hasPassword),
    }
  })
}

export async function getTeamMember(id: string): Promise<TeamMemberRow | null> {
  const [row] = await listTeamMembersById(id)
  return row ?? null
}

async function listTeamMembersById(id: string) {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      active: users.active,
      permissions: users.permissions,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1)

  return rows.map((row) => {
    const role: Role = isRole(row.role) ? row.role : "OPERATOR"
    const overrides = row.permissions as Permission[] | null
    return {
      ...row,
      role,
      overrides,
      permissions: effectivePermissions(role, overrides),
      hasPassword: true,
    }
  })
}

/** How many active superadmins exist. Guards against removing the last one. */
export async function activeSuperadminCount(): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(users)
    .where(and(eq(users.role, "SUPERADMIN"), eq(users.active, true)))

  return Number(row?.value ?? 0)
}

/** Does this email already belong to an account? Emails are stored lowercase. */
export async function findUserByEmail(email: string) {
  const [row] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1)

  return row ?? null
}

export async function hasCredential(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")))
    .limit(1)

  return Boolean(row)
}
