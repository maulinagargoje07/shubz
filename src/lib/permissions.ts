/**
 * Roles and capabilities.
 *
 * Roles are the thing a human assigns; permissions are the thing the code
 * checks. Keeping those separate means a guard reads `can(user, "RECORD_PAYMENTS")`
 * rather than enumerating which roles happen to be allowed today — so adding a
 * role later does not mean hunting through every call site.
 *
 * This module is deliberately pure: no database, no session, no server-only
 * imports. Both the server guards and the permission-toggle UI read the same
 * definitions, so what an admin sees ticked is exactly what the server enforces.
 */

export const ROLES = ["SUPERADMIN", "ADMIN", "MANAGER", "OPERATOR"] as const
export type Role = (typeof ROLES)[number]

export const PERMISSIONS = [
  "MANAGE_USERS",
  "MANAGE_SETTINGS",
  "VIEW_FINANCIALS",
  "RECORD_PAYMENTS",
  "MANAGE_ENROLLMENTS",
  "MANAGE_PROGRAMS",
  "MANAGE_CONTACTS",
  "MANAGE_ATTENDANCE",
  "SEND_CAMPAIGNS",
  "EXPORT_DATA",
  "DELETE_RECORDS",
] as const
export type Permission = (typeof PERMISSIONS)[number]

export const ROLE_LABELS: Record<Role, string> = {
  SUPERADMIN: "Superadmin",
  ADMIN: "Admin",
  MANAGER: "Manager",
  OPERATOR: "Operator",
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  SUPERADMIN: "Full system control, including team management and settings.",
  ADMIN: "Operations: programs, batches, enrollments, payments and reports.",
  MANAGER: "Daily work: enrollments, attendance, contacts and campaigns.",
  OPERATOR: "Front desk: attendance, contact enquiries and notes.",
}

export const PERMISSION_LABELS: Record<Permission, string> = {
  MANAGE_USERS: "Manage team members",
  MANAGE_SETTINGS: "Change system settings",
  VIEW_FINANCIALS: "View fees and revenue",
  RECORD_PAYMENTS: "Record and void payments",
  MANAGE_ENROLLMENTS: "Create and edit enrollments",
  MANAGE_PROGRAMS: "Manage programs, batches and sessions",
  MANAGE_CONTACTS: "Create and edit contacts",
  MANAGE_ATTENDANCE: "Mark attendance",
  SEND_CAMPAIGNS: "Send campaigns",
  EXPORT_DATA: "Export data to CSV",
  DELETE_RECORDS: "Delete records",
}

/** Grouping for the permission-toggle UI, so the list is scannable. */
export const PERMISSION_GROUPS: { heading: string; permissions: Permission[] }[] = [
  {
    heading: "Money",
    permissions: ["VIEW_FINANCIALS", "RECORD_PAYMENTS", "MANAGE_ENROLLMENTS"],
  },
  {
    heading: "Catalogue & people",
    permissions: ["MANAGE_PROGRAMS", "MANAGE_CONTACTS", "MANAGE_ATTENDANCE"],
  },
  {
    heading: "Data",
    permissions: ["EXPORT_DATA", "SEND_CAMPAIGNS", "DELETE_RECORDS"],
  },
  {
    heading: "Administration",
    permissions: ["MANAGE_USERS", "MANAGE_SETTINGS"],
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
 * themselves. A superadmin can still grant it to a specific admin as an
 * override.
 */
const ROLE_PERMISSIONS: Record<Exclude<Role, "SUPERADMIN">, Permission[]> = {
  ADMIN: [
    "VIEW_FINANCIALS",
    "RECORD_PAYMENTS",
    "MANAGE_ENROLLMENTS",
    "MANAGE_PROGRAMS",
    "MANAGE_CONTACTS",
    "MANAGE_ATTENDANCE",
    "SEND_CAMPAIGNS",
    "EXPORT_DATA",
    "DELETE_RECORDS",
  ],
  MANAGER: [
    "VIEW_FINANCIALS",
    "RECORD_PAYMENTS",
    "MANAGE_ENROLLMENTS",
    "MANAGE_CONTACTS",
    "MANAGE_ATTENDANCE",
    "SEND_CAMPAIGNS",
    "EXPORT_DATA",
  ],
  OPERATOR: ["MANAGE_ATTENDANCE", "MANAGE_CONTACTS"],
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

export function canAll(
  user: { role: Role; permissions: Permission[] },
  permissions: Permission[]
): boolean {
  return permissions.every((p) => can(user, p))
}

export function canAny(
  user: { role: Role; permissions: Permission[] },
  permissions: Permission[]
): boolean {
  return permissions.some((p) => can(user, p))
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
  return ["ADMIN", "MANAGER", "OPERATOR"]
}
