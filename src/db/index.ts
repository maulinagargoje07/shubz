/**
 * The database client.
 *
 * One pg Pool for the whole process, cached on globalThis so Next.js hot
 * reloading in development does not open a new pool on every edit and exhaust
 * Postgres connections.
 *
 * SSL: Railway's public proxy endpoint requires TLS but presents a certificate
 * that does not chain to a public root, so verification is disabled while
 * still encrypting the connection. On Railway's internal network
 * (`*.railway.internal`) traffic never leaves the private network and TLS is
 * not used.
 */

import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { env } from "@/lib/env"
import * as schema from "./schema"

function createPool(): Pool {
  const url = env.DATABASE_URL
  const isInternal = url.includes(".railway.internal")

  return new Pool({
    connectionString: url,
    ssl: isInternal ? undefined : { rejectUnauthorized: false },
    // Railway's starter Postgres allows a modest connection count; a serverful
    // Next.js process only needs a handful.
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  })
}

const globalForDb = globalThis as unknown as { __shubzPool?: Pool }

export const pool = globalForDb.__shubzPool ?? createPool()

if (process.env.NODE_ENV !== "production") {
  globalForDb.__shubzPool = pool
}

export const db = drizzle(pool, { schema })

export type Db = typeof db
/** A transaction handle, for helpers that must run inside an existing tx. */
export type DbTx = Parameters<Parameters<Db["transaction"]>[0]>[0]

export * as schema from "./schema"
