import { config } from "dotenv"
import { defineConfig } from "drizzle-kit"

config({ path: ".env", quiet: true })

/**
 * `drizzle-kit generate` diffs the TypeScript schema against the committed
 * migration files and never opens a connection, so it must work before a
 * database exists. Only `studio` and `check` actually dial out; those fail
 * with a clear Postgres error if this placeholder is still in place.
 */
const url =
  process.env.DATABASE_URL ?? "postgresql://placeholder:placeholder@localhost:5432/placeholder"

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url,
    ssl: url.includes(".railway.internal") ? undefined : { rejectUnauthorized: false },
  },
  // Migration files are generated and committed. `push` is never used after
  // the first deploy — see AGENTS.md.
  strict: true,
  verbose: true,
})
