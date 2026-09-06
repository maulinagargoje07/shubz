/**
 * Repair data left inconsistent by older behaviour.
 *
 * Deleting an enrollment used not to soft-delete its payments, which left
 * money attached to a record that no longer exists. Query guards now hide
 * those rows, but the rows themselves are still wrong — this brings them into
 * line so the database matches what the application reports.
 *
 * Idempotent and safe to re-run: it only ever touches rows that are already
 * orphaned, and only sets `deleted_at`.
 */

import { config } from "dotenv"

config({ path: ".env", quiet: true })

import { drizzle } from "drizzle-orm/node-postgres"
import { sql } from "drizzle-orm"
import { Pool } from "pg"

import * as schema from "../src/db/schema"

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not set")

  const pool = new Pool({
    connectionString: url,
    ssl: url.includes(".railway.internal") ? undefined : { rejectUnauthorized: false },
    max: 1,
  })
  const db = drizzle(pool, { schema })

  const payments = await db.execute<{ receipt_no: string }>(sql`
    update payments p set deleted_at = now()
    from enrollments e
    where e.id = p.enrollment_id
      and p.deleted_at is null
      and e.deleted_at is not null
    returning p.receipt_no
  `)
  const paidRows = (payments as unknown as { rows: { receipt_no: string }[] }).rows
  console.log(`  payments on deleted enrollments: ${paidRows.length} closed`)
  for (const r of paidRows) console.log(`    ${r.receipt_no}`)

  const enrollments = await db.execute<{ id: string }>(sql`
    update enrollments e set deleted_at = now()
    from contacts c
    where c.id = e.contact_id
      and e.deleted_at is null
      and c.deleted_at is not null
    returning e.id
  `)
  const enrRows = (enrollments as unknown as { rows: { id: string }[] }).rows
  console.log(`  enrollments on deleted contacts: ${enrRows.length} closed`)

  console.log("\nDone.")
  await pool.end()
}

main().catch((error) => {
  console.error("Repair failed:")
  console.error(error)
  process.exit(1)
})
