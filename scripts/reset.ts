/**
 * Clear all business data and leave the app ready for real records.
 *
 * KEEPS the auth tables — user, account, session, verification — so you are
 * not locked out of your own application. Everything else goes.
 *
 * Then provisions the four programs this business actually sells, so the
 * Money section is immediately usable: filters have options, and records land
 * on real catalogue rows rather than auto-creating them on first use.
 *
 * Requires --yes. This is irreversible against a live database, and a script
 * that wipes the fee book should not be one keystroke away from running.
 * Take a backup first: `npm run db:backup`.
 */

import { config } from "dotenv"

config({ path: ".env", quiet: true })

import { drizzle } from "drizzle-orm/node-postgres"
import { sql } from "drizzle-orm"
import { Pool } from "pg"

import * as schema from "../src/db/schema"
import { newId } from "../src/lib/ids"

/** The four options the student-record form offers. */
const PROGRAMS = [
  {
    code: "MENTORSHIP-ONLINE",
    name: "Mentorship (Online)",
    type: "MENTORSHIP" as const,
    deliveryMode: "ONLINE" as const,
    billingType: "ONE_TIME" as const,
    billingCycle: null,
  },
  {
    code: "MENTORSHIP-OFFLINE",
    name: "Mentorship (Offline)",
    type: "MENTORSHIP" as const,
    deliveryMode: "OFFLINE" as const,
    billingType: "ONE_TIME" as const,
    billingCycle: null,
  },
  {
    code: "TRADING-FLOOR-ONLINE",
    name: "Trading Floor (Online)",
    type: "TRADING_FLOOR" as const,
    deliveryMode: "ONLINE" as const,
    billingType: "ONE_TIME" as const,
    billingCycle: null,
  },
  {
    code: "TRADING-FLOOR-OFFLINE",
    name: "Trading Floor (Offline)",
    type: "TRADING_FLOOR" as const,
    deliveryMode: "OFFLINE" as const,
    billingType: "ONE_TIME" as const,
    billingCycle: null,
  },
]

async function main() {
  if (!process.argv.includes("--yes")) {
    console.error(
      "Refusing to run without --yes.\n\n" +
        "  This deletes every contact, enrollment, payment and attendance row.\n" +
        "  Back up first:  npm run db:backup\n" +
        "  Then:           npm run db:reset -- --yes\n"
    )
    process.exit(1)
  }

  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not set")

  const pool = new Pool({
    connectionString: url,
    ssl: url.includes(".railway.internal") ? undefined : { rejectUnauthorized: false },
    max: 1,
  })
  const db = drizzle(pool, { schema })

  const before = await db.execute<{ n: string }>(
    sql`select count(*)::text n from contacts`
  )
  const contactCount = (before as unknown as { rows: { n: string }[] }).rows[0]?.n ?? "0"

  console.log(`Clearing business data (${contactCount} contacts)…`)

  // One statement, FK-safe. `restart identity cascade` also clears anything
  // that references these rows.
  await db.execute(sql`
    truncate table
      attendance, payment_schedule, payments, enrollments,
      sessions, batches, programs,
      contact_tags, consent_events, notes, contacts, tags,
      import_rows, imports, audit_log,
      campaign_recipients, campaigns, message_events, messages,
      message_templates, webhook_events, scheduled_jobs
    restart identity cascade
  `)
  console.log("  cleared")

  const [admin] = await db
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .orderBy(schema.users.createdAt)
    .limit(1)

  await db.insert(schema.programs).values(
    PROGRAMS.map((p) => ({
      id: newId(),
      name: p.name,
      code: p.code,
      type: p.type,
      deliveryMode: p.deliveryMode,
      defaultFeePaise: 0,
      defaultBillingType: p.billingType,
      defaultBillingCycle: p.billingCycle,
      status: "ACTIVE" as const,
      createdBy: admin?.id ?? null,
    }))
  )

  console.log(`  provisioned ${PROGRAMS.length} programs:`)
  for (const p of PROGRAMS) console.log(`    ${p.name}`)

  console.log(`\n  sign-in preserved: ${admin?.email ?? "(no user found)"}`)
  console.log("\nDone. The Money section is empty and ready for real records.")

  await pool.end()
}

main().catch((error) => {
  console.error("Reset failed:")
  console.error(error)
  process.exit(1)
})
