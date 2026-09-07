/**
 * Merge batches that duplicate a name within the same program.
 *
 * `createBatch` only ever checked that the CODE was unique, so a batch could
 * be created with the same name as an existing one under a different code —
 * which is how "B4" came to exist twice under Mentorship (Offline). The
 * enrolment form resolves batches by name, so the two were indistinguishable
 * in every dropdown.
 *
 * The keeper is the batch with the most live enrollments, then the oldest.
 * Enrollments and sessions move onto it; the empty duplicate is removed.
 * Idempotent and safe to re-run.
 *
 *   npm run db:merge-batches            # report only
 *   npm run db:merge-batches -- --yes   # apply
 */

import { config } from "dotenv"

config({ path: ".env", quiet: true })

import { drizzle } from "drizzle-orm/node-postgres"
import { sql } from "drizzle-orm"
import { Pool } from "pg"

import * as schema from "../src/db/schema"

type Row = {
  id: string
  name: string
  code: string
  program_id: string
  program_name: string
  enrols: string
  sessions: string
}

async function main() {
  const apply = process.argv.includes("--yes")
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not set")

  const pool = new Pool({
    connectionString: url,
    ssl: url.includes(".railway.internal") ? undefined : { rejectUnauthorized: false },
    max: 1,
  })
  const db = drizzle(pool, { schema })
  const q = async <T>(s: ReturnType<typeof sql>) =>
    ((await db.execute(s)) as unknown as { rows: T[] }).rows

  const groups = await q<{ program_id: string; program_name: string; bname: string }>(sql`
    select b.program_id, p.name program_name, lower(trim(b.name)) bname
    from batches b join programs p on p.id = b.program_id
    group by b.program_id, p.name, lower(trim(b.name))
    having count(*) > 1
    order by p.name, bname
  `)

  if (groups.length === 0) {
    console.log("No duplicate batch names. Nothing to do.")
    await pool.end()
    return
  }

  console.log(`${groups.length} duplicated batch name(s):\n`)
  let moved = 0
  let removed = 0

  for (const group of groups) {
    const rows = await q<Row>(sql`
      select b.id, b.name, b.code, b.program_id, p.name program_name,
        (select count(*) from enrollments e
          where e.batch_id = b.id and e.deleted_at is null)::text enrols,
        (select count(*) from sessions s where s.batch_id = b.id)::text sessions
      from batches b join programs p on p.id = b.program_id
      where b.program_id = ${group.program_id}
        and lower(trim(b.name)) = ${group.bname}
      order by
        (select count(*) from enrollments e
          where e.batch_id = b.id and e.deleted_at is null) desc,
        b.created_at asc
    `)

    const [keeper, ...losers] = rows
    console.log(`  "${keeper.name}" in ${keeper.program_name}`)
    console.log(`    keep   ${keeper.code} (${keeper.enrols} enrolments, ${keeper.sessions} sessions)`)

    for (const loser of losers) {
      console.log(`    merge  ${loser.code} (${loser.enrols} enrolments, ${loser.sessions} sessions)`)

      if (!apply) continue

      await db.transaction(async (tx) => {
        /*
         * Enrollments move first. The partial unique index
         * (contact_id, batch_id) means a student enrolled in BOTH duplicates
         * would collide on the move, so those rows are soft-deleted instead of
         * repointed — the keeper already holds their enrolment.
         */
        await tx.execute(sql`
          update enrollments e set deleted_at = now(), updated_at = now()
          where e.batch_id = ${loser.id}
            and e.deleted_at is null
            and exists (
              select 1 from enrollments k
              where k.batch_id = ${keeper.id}
                and k.contact_id = e.contact_id
                and k.deleted_at is null
            )
        `)
        await tx.execute(sql`
          update enrollments set batch_id = ${keeper.id}, updated_at = now()
          where batch_id = ${loser.id} and deleted_at is null
        `)

        /*
         * Sessions move next, renumbered onto the end of the keeper's run so
         * they cannot collide on the unique (batch_id, seq) index.
         */
        await tx.execute(sql`
          with base as (
            select coalesce(max(seq), 0) as m from sessions where batch_id = ${keeper.id}
          ),
          ordered as (
            select id, row_number() over (order by scheduled_at, seq) rn
            from sessions where batch_id = ${loser.id}
          )
          update sessions s
          set batch_id = ${keeper.id}, seq = base.m + ordered.rn, updated_at = now()
          from ordered, base
          where s.id = ordered.id
        `)

        // Anything still pointing at the loser is soft-deleted, not orphaned.
        await tx.execute(sql`
          update enrollments set batch_id = null, updated_at = now()
          where batch_id = ${loser.id}
        `)
        await tx.execute(sql`delete from batches where id = ${loser.id}`)
      })

      moved++
      removed++
    }
    console.log("")
  }

  if (!apply) {
    console.log("Dry run. Re-run with --yes to apply.")
  } else {
    console.log(`Merged ${moved} duplicate(s); removed ${removed} batch row(s).`)
  }

  await pool.end()
}

main().catch((error) => {
  console.error("Merge failed:")
  console.error(error)
  process.exit(1)
})
