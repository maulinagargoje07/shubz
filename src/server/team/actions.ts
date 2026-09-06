"use server"

/**
 * Team management.
 *
 * Every action here starts with `requirePermission("MANAGE_USERS")`, which
 * only a superadmin has by default. That check is the authorisation boundary —
 * hiding the page from the sidebar is presentation, not security, and a
 * non-superadmin posting straight at these actions has to be stopped here.
 *
 * Three invariants are enforced regardless of who is calling:
 *
 *   1. Only a superadmin can create or promote to SUPERADMIN. Otherwise a
 *      delegated admin could mint themselves a root account.
 *   2. Nobody can deactivate or demote themselves. Locking yourself out of the
 *      only account that can manage users needs database access to undo.
 *   3. The last active superadmin cannot be removed or demoted, for the same
 *      reason.
 */

import { and, eq } from "drizzle-orm"

import { db } from "@/db"
import { accounts, users } from "@/db/schema"
import { mutate } from "@/lib/audit"
import { newId } from "@/lib/ids"
import { revalidateEverything } from "@/lib/revalidate"
import { assignableRoles, effectivePermissions } from "@/lib/permissions"
import {
  ForbiddenError,
  requirePermission,
  type SessionUser,
} from "@/lib/session"
import type { ActionResult } from "@/lib/validation/shared"
import {
  createTeamMemberSchema,
  resetTeamMemberPasswordSchema,
  toggleTeamMemberStatusSchema,
  updateTeamMemberSchema,
} from "@/lib/validation/team"
import { activeSuperadminCount, findUserByEmail } from "./queries"

function fieldErrorsOf(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "")
    if (key && !out[key]) out[key] = issue.message
  }
  return out
}

/** Turn a thrown guard failure into the result shape the forms already handle. */
function asFailure(error: unknown): ActionResult<never> {
  if (error instanceof ForbiddenError) return { ok: false, error: error.message }
  throw error
}

/** Hash through Better Auth's own context, so sign-in verifies the result. */
async function hashPassword(plain: string): Promise<string> {
  const { auth } = await import("@/lib/auth")
  const ctx = await auth.$context
  return ctx.password.hash(plain)
}

function guardRoleAssignment(actor: SessionUser, role: string): string | null {
  if (!assignableRoles(actor.role).includes(role as never)) {
    return "Only a superadmin can assign the superadmin role."
  }
  return null
}

// ------------------------------------------------------------------ create

export async function createTeamMember(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  let actor: SessionUser
  try {
    actor = await requirePermission("MANAGE_USERS")
  } catch (error) {
    return asFailure(error)
  }

  const parsed = createTeamMemberSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsOf(parsed.error),
    }
  }

  const values = parsed.data

  const roleError = guardRoleAssignment(actor, values.role)
  if (roleError) return { ok: false, error: roleError, fieldErrors: { role: roleError } }

  const clash = await findUserByEmail(values.email)
  if (clash) {
    return {
      ok: false,
      error: "That email already has an account.",
      fieldErrors: { email: `${clash.name} already uses this email.` },
    }
  }

  const passwordHash = await hashPassword(values.password)

  const id = await mutate(actor, async ({ tx, audit }) => {
    const userId = newId()

    const [row] = await tx
      .insert(users)
      .values({
        id: userId,
        name: values.name,
        email: values.email,
        emailVerified: true,
        role: values.role,
        active: true,
        permissions: values.permissions,
      })
      .returning()

    // Credentials live in `account`, not on the user row.
    await tx.insert(accounts).values({
      id: newId(),
      userId,
      accountId: userId,
      providerId: "credential",
      password: passwordHash,
    })

    await audit({
      action: "USER_CREATED",
      entity: "user",
      entityId: userId,
      // The hash is deliberately absent: an audit log is read by people, and a
      // credential does not belong in one.
      after: {
        name: row.name,
        email: row.email,
        role: row.role,
        active: row.active,
        permissions: effectivePermissions(values.role, values.permissions),
      },
    })

    return userId
  })

  revalidateEverything()
  return { ok: true, data: { id } }
}

// ------------------------------------------------------------------ update

export async function updateTeamMember(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  let actor: SessionUser
  try {
    actor = await requirePermission("MANAGE_USERS")
  } catch (error) {
    return asFailure(error)
  }

  const parsed = updateTeamMemberSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsOf(parsed.error),
    }
  }

  const values = parsed.data

  const roleError = guardRoleAssignment(actor, values.role)
  if (roleError) return { ok: false, error: roleError, fieldErrors: { role: roleError } }

  const before = await db.query.users.findFirst({ where: eq(users.id, values.id) })
  if (!before) return { ok: false, error: "That team member no longer exists." }

  if (values.id === actor.id && values.role !== actor.role) {
    return {
      ok: false,
      error: "You cannot change your own role. Ask another superadmin to do it.",
      fieldErrors: { role: "You cannot change your own role." },
    }
  }

  // Demoting the last superadmin would leave nobody able to manage the team.
  if (before.role === "SUPERADMIN" && values.role !== "SUPERADMIN") {
    if ((await activeSuperadminCount()) <= 1) {
      return {
        ok: false,
        error: "This is the only active superadmin. Promote someone else first.",
        fieldErrors: { role: "The last superadmin cannot be demoted." },
      }
    }
  }

  await mutate(actor, async ({ tx, audit }) => {
    const [after] = await tx
      .update(users)
      .set({
        name: values.name,
        role: values.role,
        permissions: values.permissions,
        updatedAt: new Date(),
      })
      .where(eq(users.id, values.id))
      .returning()

    await audit({
      action: "USER_UPDATED",
      entity: "user",
      entityId: values.id,
      before: {
        name: before.name,
        role: before.role,
        permissions: before.permissions,
      },
      after: {
        name: after.name,
        role: after.role,
        permissions: after.permissions,
        effective: effectivePermissions(values.role, values.permissions),
      },
    })
  })

  revalidateEverything()
  return { ok: true, data: { id: values.id } }
}

// ------------------------------------------------------- activate/deactivate

export async function setTeamMemberStatus(
  input: unknown
): Promise<ActionResult<{ id: string; active: boolean }>> {
  let actor: SessionUser
  try {
    actor = await requirePermission("MANAGE_USERS")
  } catch (error) {
    return asFailure(error)
  }

  const parsed = toggleTeamMemberStatusSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Unknown request." }

  const { id, active } = parsed.data

  if (id === actor.id && !active) {
    return { ok: false, error: "You cannot deactivate your own account." }
  }

  const before = await db.query.users.findFirst({ where: eq(users.id, id) })
  if (!before) return { ok: false, error: "That team member no longer exists." }

  if (before.role === "SUPERADMIN" && !active && (await activeSuperadminCount()) <= 1) {
    return {
      ok: false,
      error: "This is the only active superadmin. Promote someone else first.",
    }
  }

  await mutate(actor, async ({ tx, audit }) => {
    const [after] = await tx
      .update(users)
      .set({ active, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning()

    await audit({
      action: active ? "USER_ACTIVATED" : "USER_DEACTIVATED",
      entity: "user",
      entityId: id,
      before: { active: before.active },
      after: { active: after.active },
    })
  })

  // getSessionUser() reads role and active from the database on every request,
  // so a deactivated user is locked out on their very next page load — no
  // session hunting required.
  revalidateEverything()
  return { ok: true, data: { id, active } }
}

// ---------------------------------------------------------- reset password

export async function resetTeamMemberPassword(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  let actor: SessionUser
  try {
    actor = await requirePermission("MANAGE_USERS")
  } catch (error) {
    return asFailure(error)
  }

  const parsed = resetTeamMemberPasswordSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsOf(parsed.error),
    }
  }

  const { id, password } = parsed.data

  const target = await db.query.users.findFirst({ where: eq(users.id, id) })
  if (!target) return { ok: false, error: "That team member no longer exists." }

  const passwordHash = await hashPassword(password)

  await mutate(actor, async ({ tx, audit }) => {
    const [credential] = await tx
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.userId, id), eq(accounts.providerId, "credential")))
      .limit(1)

    if (credential) {
      await tx
        .update(accounts)
        .set({ password: passwordHash, updatedAt: new Date() })
        .where(eq(accounts.id, credential.id))
    } else {
      // A user row created without a credential cannot sign in; this is also
      // the path that gives them one for the first time.
      await tx.insert(accounts).values({
        id: newId(),
        userId: id,
        accountId: id,
        providerId: "credential",
        password: passwordHash,
      })
    }

    await audit({
      action: "USER_PASSWORD_RESET",
      entity: "user",
      entityId: id,
      // Records that it happened and who did it. Never the password itself.
      after: { email: target.email, resetBy: actor.email },
    })
  })

  revalidateEverything()
  return { ok: true, data: { id } }
}
