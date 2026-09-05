/**
 * The database client.
 *
 * Both the pool and the drizzle instance are created LAZILY on first query.
 * `next build` imports every route module to collect page data; connecting at
 * module load would make a build require a reachable database. Deferring means
 * the build only needs the code to typecheck, while the first real query still
 * fails loudly if configuration is wrong.
 *
 * One pool per process, cached on globalThis so Next.js hot reloading does not
 * open a fresh pool on every edit and exhaust Postgres connections.
 *
 * SSL: Railway's public proxy requires TLS but presents a certificate that
 * does not chain to a public root, so verification is disabled while the
 * connection stays encrypted. On Railway's internal network
 * (`*.railway.internal`) traffic never leaves the private network and TLS is
 * not used.
 */

import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { env } from "@/lib/env"
import * as schema from "./schema"

export function poolConfigFor(url: string) {
  const isInternal = url.includes(".railway.internal")
  return {
    connectionString: url,
    ssl: isInternal ? undefined : { rejectUnauthorized: false },
    // Railway's starter Postgres allows a modest connection count, and a
    // serverful Next.js process only needs a handful.
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  }
}

const globalForDb = globalThis as unknown as {
  __shubzPool?: Pool
  __shubzDb?: DrizzleClient
}

export function getPool(): Pool {
  if (!globalForDb.__shubzPool) {
    globalForDb.__shubzPool = new Pool(poolConfigFor(env.DATABASE_URL))
  }
  return globalForDb.__shubzPool
}

type DrizzleClient = ReturnType<typeof createClient>

function createClient() {
  return drizzle(getPool(), { schema })
}

function getDb(): DrizzleClient {
  if (!globalForDb.__shubzDb) {
    globalForDb.__shubzDb = createClient()
  }
  return globalForDb.__shubzDb
}

/**
 * The drizzle client. A proxy so that merely importing this module — which
 * `next build` does for every route — does not open a connection.
 * Methods are bound to the real client so `this` behaves.
 */
export const db = new Proxy({} as DrizzleClient, {
  get(_target, prop) {
    const client = getDb() as unknown as Record<string | symbol, unknown>
    const value = client[prop]
    return typeof value === "function" ? value.bind(client) : value
  },
})

export type Db = DrizzleClient
/** A transaction handle, for helpers that must run inside an existing tx. */
export type DbTx = Parameters<Parameters<Db["transaction"]>[0]>[0]

export * as schema from "./schema"
