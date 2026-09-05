/**
 * Dump every business table to a timestamped JSON file.
 *
 * Run before anything destructive. The output contains real contact details,
 * so `backups/` is gitignored — keep these somewhere private.
 */

import { config } from "dotenv"

config({ path: ".env", quiet: true })

import { mkdirSync, writeFileSync } from "node:fs"
import { drizzle } from "drizzle-orm/node-postgres"
import { sql } from "drizzle-orm"
import { Pool } from "pg"

import * as schema from "../src/db/schema"

const TABLES = [
  "contacts",
  "tags",
  "contact_tags",
  "consent_events",
  "programs",
  "batches",
  "sessions",
  "enrollments",
  "payments",
  "payment_schedule",
  "attendance",
  "notes",
  "audit_log",
  "imports",
  "import_rows",
  "message_templates",
  "campaigns",
  "campaign_recipients",
  "messages",
  "message_events",
  "webhook_events",
  "scheduled_jobs",
] as const

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not set")

  const pool = new Pool({
    connectionString: url,
    ssl: url.includes(".railway.internal") ? undefined : { rejectUnauthorized: false },
    max: 1,
  })
  const db = drizzle(pool, { schema })

  const dump: Record<string, unknown[]> = {}
  let total = 0

  for (const table of TABLES) {
    const res = await db.execute(sql.raw(`select * from ${table}`))
    const rows = (res as unknown as { rows: unknown[] }).rows ?? []
    dump[table] = rows
    total += rows.length
    if (rows.length) console.log(`  ${table.padEnd(22)} ${rows.length}`)
  }

  mkdirSync("backups", { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
  const file = `backups/backup-${stamp}.json`
  writeFileSync(file, JSON.stringify(dump, null, 2))

  console.log(`\n  ${total} rows written to ${file}`)
  await pool.end()
}

main().catch((error) => {
  console.error("Backup failed:")
  console.error(error)
  process.exit(1)
})
