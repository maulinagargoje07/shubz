/**
 * Better Auth: email + password, session cookies.
 *
 * Better Auth owns the four auth tables. The password hash lives in
 * `account.password` (scrypt, managed by Better Auth) rather than on the user
 * row — credentials occupy the same "account" slot an OAuth provider would.
 *
 * `role` and `active` are our columns, declared here as additionalFields so
 * they round-trip through the session and are readable without a second query.
 *
 * Ids are UUID v7 from lib/ids.ts, so auth rows sort chronologically and share
 * one id scheme with the rest of the schema.
 *
 * The instance is built LAZILY behind a proxy: constructing it reads
 * BETTER_AUTH_SECRET, and `next build` imports this module for every route, so
 * eager construction would make a build require production secrets.
 */

import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nextCookies } from "better-auth/next-js"

import { db } from "@/db"
import { accounts, authSessions, users, verifications } from "@/db/schema"
import { env } from "@/lib/env"
import { newId } from "@/lib/ids"

function createAuth() {
  return betterAuth({
    appName: "ShubzTrader",
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,

    database: drizzleAdapter(db, {
      provider: "pg",
      // Our exports are plural and domain-named; Better Auth addresses models by
      // its own singular names, so map them explicitly.
      schema: {
        user: users,
        session: authSessions,
        account: accounts,
        verification: verifications,
      },
    }),

    emailAndPassword: {
      enabled: true,
      // Single-admin internal tool: no email service is wired up, so there is
      // nothing to verify against and no reset link to send.
      requireEmailVerification: false,
      minPasswordLength: 10,
    },

    user: {
      additionalFields: {
        role: {
          type: "string",
          required: false,
          defaultValue: "OPERATOR",
          // Roles are assigned by an admin, never chosen at signup.
          input: false,
        },
        active: {
          type: "boolean",
          required: false,
          defaultValue: true,
          input: false,
        },
      },
    },

    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24, // refresh the cookie at most daily
    },

    advanced: {
      database: {
        generateId: () => newId(),
      },
    },

    plugins: [
      // Must stay last: lets server actions set the session cookie.
      nextCookies(),
    ],
  })
}
export type Auth = ReturnType<typeof createAuth>

let cached: Auth | undefined

function getAuth(): Auth {
  if (!cached) cached = createAuth()
  return cached
}

/** Built on first access, so importing this module opens no connection. */
export const auth = new Proxy({} as Auth, {
  get(_target, prop) {
    const instance = getAuth() as unknown as Record<string | symbol, unknown>
    const value = instance[prop]
    return typeof value === "function" ? value.bind(instance) : value
  },
})
