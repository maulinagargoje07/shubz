"use server"

/**
 * Your own account.
 *
 * These are the only mutations that do not need a permission: everybody may
 * edit their own name and change their own password. What they deliberately
 * cannot do here is change their own role, permissions or active flag — those
 * live in team management behind MANAGE_USERS, so a manager cannot promote
 * themselves by editing their profile.
 */

import { and, eq } from "drizzle-orm"

import { db } from "@/db"
import { accounts, authSessions, users } from "@/db/schema"
import { mutate } from "@/lib/audit"
import { revalidateEverything } from "@/lib/revalidate"
import { requireUser } from "@/lib/session"
import type { ActionResult } from "@/lib/validation/shared"
import { changePasswordSchema, updateProfileSchema } from "@/lib/validation/profile"

function fieldErrorsOf(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "")
    if (key && !out[key]) out[key] = issue.message
  }
  return out
}

export async function updateOwnProfile(input: unknown): Promise<ActionResult> {
  const user = await requireUser()

  const parsed = updateProfileSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsOf(parsed.error),
    }
  }

  await mutate(user, async ({ tx, audit }) => {
    const [after] = await tx
      .update(users)
      .set({ name: parsed.data.name, updatedAt: new Date() })
      .where(eq(users.id, user.id))
      .returning()

    await audit({
      action: "PROFILE_UPDATED",
      entity: "user",
      entityId: user.id,
      before: { name: user.name },
      after: { name: after.name },
    })
  })

  revalidateEverything()
  return { ok: true, data: undefined }
}

export async function changeOwnPassword(
  input: unknown
): Promise<ActionResult<{ signedOutElsewhere: number }>> {
  const user = await requireUser()

  const parsed = changePasswordSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: fieldErrorsOf(parsed.error),
    }
  }

  const { currentPassword, newPassword } = parsed.data

  const { auth } = await import("@/lib/auth")
  const ctx = await auth.$context

  const [credential] = await db
    .select({ id: accounts.id, password: accounts.password })
    .from(accounts)
    .where(and(eq(accounts.userId, user.id), eq(accounts.providerId, "credential")))
    .limit(1)

  if (!credential?.password) {
    return {
      ok: false,
      error: "This account has no password set. Ask a superadmin to set one.",
    }
  }

  // Asked for even though they are signed in: it stops someone at an unlocked
  // laptop from silently taking over the account.
  const valid = await ctx.password.verify({
    password: currentPassword,
    hash: credential.password,
  })

  if (!valid) {
    return {
      ok: false,
      error: "That is not your current password.",
      fieldErrors: { currentPassword: "Incorrect password" },
    }
  }

  const hash = await ctx.password.hash(newPassword)
  let revokedCount = 0

  await mutate(user, async ({ tx, audit }) => {
    await tx
      .update(accounts)
      .set({ password: hash, updatedAt: new Date() })
      .where(eq(accounts.id, credential.id))

    /**
     * Every session is revoked, including this one.
     *
     * Changing a password is what you do when you suspect someone else has it,
     * so leaving other sessions signed in would defeat the point. Signing the
     * user out here too is the honest outcome — they re-enter the new password
     * once and know it took effect.
     */
    const revoked = await tx
      .delete(authSessions)
      .where(eq(authSessions.userId, user.id))
      .returning({ id: authSessions.id })

    revokedCount = revoked.length

    await audit({
      action: "PASSWORD_CHANGED",
      entity: "user",
      entityId: user.id,
      // Records that it happened, never the password or the hash.
      after: { email: user.email, sessionsRevoked: revokedCount },
    })
  })

  revalidateEverything()
  return { ok: true, data: { signedOutElsewhere: Math.max(revokedCount - 1, 0) } }
}
