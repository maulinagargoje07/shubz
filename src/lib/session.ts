/**
 * Server-side session access.
 *
 * `requireUser()` is the gate every protected page and server action passes
 * through. It rejects both "no session" and "deactivated account", so
 * switching a user's `active` flag off locks them out on their next request
 * without needing to hunt down their sessions.
 */

import { headers } from "next/headers"
import { redirect } from "next/navigation"

import type { UserRole } from "@/db/schema"
import { auth } from "@/lib/auth"

export type SessionUser = {
  id: string
  name: string
  email: string
  role: UserRole
  active: boolean
}

/** The current user, or null. Does not redirect — for optional-auth surfaces. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null

  const user = session.user as typeof session.user & {
    role?: UserRole
    active?: boolean
  }

  if (user.active === false) return null

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role ?? "OPERATOR",
    active: user.active ?? true,
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

/** Roles exist as a column; there is no permissions UI in this pass. */
export function isAdmin(user: SessionUser): boolean {
  return user.role === "ADMIN"
}
