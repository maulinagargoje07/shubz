/**
 * Create or update the root superadmin. Idempotent, and safe to re-run.
 *
 * Touches only the auth tables — no contact, enrollment or payment data is
 * read or written, so this can be run against a live database at any time.
 *
 * The password is taken from the environment, never from this file. A
 * credential committed to a repository is a credential that has leaked, and
 * `.env` is already gitignored:
 *
 *   SUPERADMIN_EMAIL=you@example.com
 *   SUPERADMIN_PASSWORD='...'
 *   SUPERADMIN_NAME='Your Name'      # optional
 *
 *   npm run setup:superadmin
 *
 * Hashing goes through Better Auth's own scrypt context rather than a hand-
 * rolled hash, so the stored credential verifies against the same code path
 * `/login` uses. A hash produced any other way would look fine in the database
 * and fail every sign-in attempt.
 */

import { config } from "dotenv"

config({ path: ".env", quiet: true })

import { drizzle } from "drizzle-orm/node-postgres"
import { and, eq, ne } from "drizzle-orm"
import { Pool } from "pg"

import * as schema from "../src/db/schema"
import { newId } from "../src/lib/ids"

const { users, accounts } = schema

/** Minimum that Better Auth is configured to accept at sign-in. */
const MIN_PASSWORD_LENGTH = 10

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not set")

  const email = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.SUPERADMIN_PASSWORD
  const name = process.env.SUPERADMIN_NAME?.trim() || "Superadmin"

  if (!email) {
    throw new Error(
      "SUPERADMIN_EMAIL is not set.\n\n" +
        "  Add it to .env (gitignored), then re-run:\n" +
        "    SUPERADMIN_EMAIL=you@example.com\n" +
        "    SUPERADMIN_PASSWORD='a-long-password'\n"
    )
  }
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `SUPERADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`
    )
  }

  const pool = new Pool({
    connectionString: url,
    ssl: url.includes(".railway.internal") ? undefined : { rejectUnauthorized: false },
    max: 1,
  })
  const db = drizzle(pool, { schema })

  // Better Auth owns password hashing; borrow its context so the stored hash
  // is byte-for-byte what sign-in will verify against.
  const { auth } = await import("../src/lib/auth")
  const ctx = await auth.$context
  const passwordHash = await ctx.password.hash(password)

  const [existing] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  const userId = existing?.id ?? newId()

  if (existing) {
    await db
      .update(users)
      .set({
        name,
        role: "SUPERADMIN",
        active: true,
        emailVerified: true,
        // Null means "use the role's defaults", and a superadmin's defaults are
        // everything. Clearing any stale override avoids a root account that is
        // somehow missing a permission.
        permissions: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
    console.log(`  updated existing user ${email} -> SUPERADMIN`)
  } else {
    await db.insert(users).values({
      id: userId,
      name,
      email,
      emailVerified: true,
      role: "SUPERADMIN",
      active: true,
      permissions: null,
    })
    console.log(`  created ${email} as SUPERADMIN`)
  }

  // Credentials live in `account` with providerId 'credential'. Upsert rather
  // than insert, so re-running this rotates the password instead of failing.
  const [credential] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")))
    .limit(1)

  if (credential) {
    await db
      .update(accounts)
      .set({ password: passwordHash, updatedAt: new Date() })
      .where(eq(accounts.id, credential.id))
    console.log("  password rotated")
  } else {
    await db.insert(accounts).values({
      id: newId(),
      userId,
      accountId: userId,
      providerId: "credential",
      password: passwordHash,
    })
    console.log("  credential created")
  }

  /**
   * Demote any other superadmin to ADMIN.
   *
   * There is exactly one root account. Leaving a forgotten second superadmin
   * in place would mean an account nobody remembers can still manage the team
   * and reset passwords. Demoting rather than deleting keeps their audit trail
   * and their foreign keys intact.
   */
  const demoted = await db
    .update(users)
    .set({ role: "ADMIN", updatedAt: new Date() })
    .where(and(eq(users.role, "SUPERADMIN"), ne(users.id, userId)))
    .returning({ email: users.email })

  for (const row of demoted) {
    console.log(`  demoted previous superadmin ${row.email} -> ADMIN`)
  }

  const total = await db.select({ id: users.id }).from(users)
  console.log(`\n  ${email} can now sign in at /login`)
  console.log(`  ${total.length} user account(s) in total`)

  await pool.end()
}

main().catch((error) => {
  console.error("\nSuperadmin setup failed:")
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
