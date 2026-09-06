/**
 * Server-side session access and authorisation.
 *
 * `requireUser()` is the gate every protected page and server action passes
 * through. It rejects both "no session" and "deactivated account", so
 * switching a user's `active` flag off locks them out on their next request
 * without needing to hunt down their sessions.
 *
 * Role and permissions are read from the DATABASE on every request, not from
 * the session cookie. Better Auth round-trips additional fields through the
 * session, but that copy is a snapshot from sign-in time: demote someone or
 * revoke a permission and they would keep the old rights until their cookie
 * expired. For an access-control decision that is the wrong trade — a
 * revocation has to bite immediately.
 */

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { eq } from "drizzle-orm"

import { db } from "@/db"
import { users } from "@/db/schema"
import { auth } from "@/lib/auth"
import {
  can,
  effectivePermissions,
  isRole,
  type Permission,
  type Role,
} from "@/lib/permissions"

export type SessionUser = {
  id: string
  name: string
  email: string
  role: Role
  active: boolean
  /** Resolved from the role's defaults plus any per-user override. */
  permissions: Permission[]
}

/** The current user, or null. Does not redirect — for optional-auth surfaces. */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return null

    // Authoritative read. See the note above on why the cookie is not trusted
    // for role or permissions.
    const [row] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        active: users.active,
        permissions: users.permissions,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1)

    if (!row || !row.active) return null

    const role: Role = isRole(row.role) ? row.role : "OPERATOR"

    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role,
      active: row.active,
      permissions: effectivePermissions(role, row.permissions),
    }
  } catch (error) {
    console.error("Failed to retrieve session:", error)
    return null
  }
}

/**
 * The current user, or a redirect to /login. Use at the top of every
 * protected page and server action.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  return user
}

// ------------------------------------------------------------ predicates

export function isSuperAdmin(user: SessionUser): boolean {
  return user.role === "SUPERADMIN"
}

export function isAdmin(user: SessionUser): boolean {
  return user.role === "ADMIN" || user.role === "SUPERADMIN"
}

export function hasRole(user: SessionUser, allowed: readonly Role[]): boolean {
  return allowed.includes(user.role)
}

export function hasPermission(user: SessionUser, permission: Permission): boolean {
  return can(user, permission)
}

// --------------------------------------------------------------- guards

/**
 * Thrown when a signed-in user lacks the rights for something.
 *
 * A distinct error type so server actions can turn it into a message rather
 * than a 500, and so a missing guard fails loudly in development instead of
 * quietly allowing the mutation.
 */
export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to do that.") {
    super(message)
    this.name = "ForbiddenError"
  }
}

/**
 * Page guard. Redirects rather than throwing, because a browser navigation to
 * a forbidden page should land somewhere useful, not on an error screen.
 */
export async function requireRole(allowed: readonly Role[]): Promise<SessionUser> {
  const user = await requireUser()
  if (!hasRole(user, allowed)) redirect("/dashboard?denied=1")
  return user
}

export async function requirePermissionPage(
  permission: Permission
): Promise<SessionUser> {
  const user = await requireUser()
  if (!can(user, permission)) redirect("/dashboard?denied=1")
  return user
}

/**
 * Server-action guard. Throws, so the action returns a handled failure instead
 * of redirecting mid-mutation.
 */
export async function requirePermission(
  permission: Permission
): Promise<SessionUser> {
  const user = await requireUser()
  if (!can(user, permission)) {
    throw new ForbiddenError(
      `This action needs the "${permission}" permission, which your account does not have.`
    )
  }
  return user
}

/**
 * Non-throwing guard for server actions.
 *
 * `requirePermission` throws, which is right for a page but wrong inside an
 * action that returns `{ ok, error }` — a thrown error surfaces to the user as
 * a generic server failure rather than "you cannot do that". This returns the
 * same shape the actions already handle, so a denied click reads as a normal
 * refusal.
 *
 *   const gate = await checkPermission("RECORD_PAYMENTS")
 *   if (!gate.ok) return gate
 *   const user = gate.user
 */
export async function checkPermission(
  permission: Permission
): Promise<{ ok: true; user: SessionUser } | { ok: false; error: string }> {
  const user = await getSessionUser()
  if (!user) return { ok: false, error: "Your session has expired. Sign in again." }

  if (!can(user, permission)) {
    return {
      ok: false,
      error: "You do not have permission to do that. Ask a superadmin for access.",
    }
  }

  return { ok: true, user }
}
