/**
 * Roles and capabilities.
 *
 * Roles are the thing a human assigns; permissions are the thing the code
 * checks. Keeping those separate means a guard reads
 * `can(user, "MANAGE_TRADINGVIEW_ACCESS")` rather than enumerating which roles
 * happen to be allowed today — so changing what a role includes does not mean
 * hunting through every call site.
 *
 * This module is deliberately pure: no database, no session, no server-only
 * imports. Both the server guards and the permission-toggle UI read the same
 * definitions, so what a superadmin sees ticked is exactly what the server
 * enforces.
 */

export const ROLES = ["SUPERADMIN", "ADMIN"] as const
export type Role = (typeof ROLES)[number]

export const PERMISSIONS = [
  /** See subscribers, payments and failed payments. */
  "VIEW_INDICATOR",
  /** Tick or untick "TradingView access given" on a subscriber. */
  "MANAGE_TRADINGVIEW_ACCESS",
  /** Download the Excel and CSV exports. */
  "EXPORT_DATA",
  /** Add admins, change their access, reset passwords, switch accounts off. */
  "MANAGE_USERS",
] as const
export type Permission = (typeof PERMISSIONS)[number]

export const ROLE_LABELS: Record<Role, string> = {
  SUPERADMIN: "Superadmin",
  ADMIN: "Admin",
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  SUPERADMIN: "Everything, including adding admins and deciding what they can do.",
  ADMIN: "Sees subscribers and payments, ticks TradingView access and downloads exports.",
}

export const PERMISSION_LABELS: Record<Permission, string> = {
  VIEW_INDICATOR: "See subscribers and payments",
  MANAGE_TRADINGVIEW_ACCESS: "Tick TradingView access",
  EXPORT_DATA: "Download Excel and CSV exports",
  MANAGE_USERS: "Manage team members",
}

/** Grouping for the permission-toggle UI, so the list is scannable. */
export const PERMISSION_GROUPS: { heading: string; permissions: Permission[] }[] = [
  {
    heading: "Indicator",
    permissions: ["VIEW_INDICATOR", "MANAGE_TRADINGVIEW_ACCESS", "EXPORT_DATA"],
  },
  {
    heading: "Administration",
    permissions: ["MANAGE_USERS"],
  },
]

/**
 * What each role can do by default.
 *
 * SUPERADMIN is not listed: it short-circuits to everything in `can()`, so a
 * permission added later is automatically available to it rather than silently
 * missing until someone remembers to update a list.
 *
 * ADMIN deliberately does NOT get MANAGE_USERS. Team management is the
 * superadmin's, and handing it out by default would let any admin promote
 * themselves. A superadmin can still grant it to a specific admin.
 */
const ROLE_PERMISSIONS: Record<Exclude<Role, "SUPERADMIN">, Permission[]> = {
  ADMIN: ["VIEW_INDICATOR", "MANAGE_TRADINGVIEW_ACCESS", "EXPORT_DATA"],
}

export function defaultPermissionsFor(role: Role): Permission[] {
  if (role === "SUPERADMIN") return [...PERMISSIONS]
  return [...ROLE_PERMISSIONS[role]]
}

/**
 * The permissions a user actually has.
 *
 * `overrides` is the per-user column. When null the role's defaults apply;
 * when set it REPLACES them, so a superadmin ticking boxes gets exactly what
 * they ticked rather than an opaque union. SUPERADMIN ignores overrides
 * entirely — a root account that could be stripped of MANAGE_USERS is a
 * lockout waiting to happen.
 */
export function effectivePermissions(
  role: Role,
  overrides?: string[] | null
): Permission[] {
  if (role === "SUPERADMIN") return [...PERMISSIONS]
  if (overrides == null) return defaultPermissionsFor(role)

  const valid = new Set<string>(PERMISSIONS)
  return overrides.filter((p): p is Permission => valid.has(p))
}

export function can(
  user: { role: Role; permissions: Permission[] },
  permission: Permission
): boolean {
  if (user.role === "SUPERADMIN") return true
  return user.permissions.includes(permission)
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value)
}

export function isPermission(value: unknown): value is Permission {
  return typeof value === "string" && (PERMISSIONS as readonly string[]).includes(value)
}

/**
 * Roles a given actor is allowed to assign.
 *
 * Only a superadmin can mint another superadmin. Without this an admin with
 * delegated MANAGE_USERS could create a superadmin and escalate sideways.
 */
export function assignableRoles(actorRole: Role): Role[] {
  if (actorRole === "SUPERADMIN") return [...ROLES]
  return ["ADMIN"]
}

/**
 * Where a signed-in user lands: the indicator overview if they may see it,
 * otherwise their profile, which everyone has. Never a page that would bounce
 * them straight back, so a denied redirect can't loop.
 */
export function homePathFor(user: { role: Role; permissions: Permission[] }): string {
  return can(user, "VIEW_INDICATOR") ? "/indicator" : "/settings/profile"
}

/**
 * Every permission is reachable from the team settings UI.
 *
 * The picker renders PERMISSION_GROUPS, not PERMISSIONS, so a permission left
 * out of a group exists in the model and in the guards but can never be granted
 * or revoked by hand — invisible, and therefore unusable. This keeps the two
 * lists honest: adding a permission without grouping it fails here rather than
 * being discovered months later by someone who cannot switch it off.
 */
const GROUPED = new Set(PERMISSION_GROUPS.flatMap((g) => g.permissions))
const UNGROUPED = PERMISSIONS.filter((p) => !GROUPED.has(p))
if (UNGROUPED.length > 0) {
  throw new Error(
    `Permissions missing from PERMISSION_GROUPS, so they cannot be granted in the UI: ${UNGROUPED.join(", ")}`
  )
}
