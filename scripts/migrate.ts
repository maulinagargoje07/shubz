/**
 * Apply pending migrations.
 *
 * Uses drizzle's migrator rather than `drizzle-kit push`, so what runs against
 * production is exactly the committed SQL in drizzle/ — reviewed, ordered, and
 * recorded in the __drizzle_migrations table. See AGENTS.md: push is never
 * used after the first deploy.
 */

import { config } from "dotenv"

config({ path: ".env", quiet: true })

import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { Pool } from "pg"

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and paste your Railway connection string."
    )
  }

  const pool = new Pool({
    connectionString: url,
    ssl: url.includes(".railway.internal") ? undefined : { rejectUnauthorized: false },
    max: 1,
  })

  const db = drizzle(pool)

  console.log("Applying migrations from ./drizzle ...")
  await migrate(db, { migrationsFolder: "./drizzle" })
  console.log("Migrations applied.")

  await pool.end()
}

main().catch((error) => {
  console.error("Migration failed:")
  console.error(error)
  process.exit(1)
})
