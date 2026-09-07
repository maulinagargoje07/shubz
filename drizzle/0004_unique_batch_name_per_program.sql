-- One batch name per program.
--
-- `batches.code` was already unique, but the NAME was not — and the name is
-- what people actually pick from ("B4"), and what the enrolment form resolves
-- against. So a batch created by hand as "B4" with code "SEPTEMBER" sat
-- alongside the "B4" the enrolment form had created, and every dropdown showed
-- two indistinguishable entries.
--
-- Case- and whitespace-insensitive, because "b4", "B4 " and "B4" are the same
-- batch to a human. Scoped per program: "B1" under Mentorship and "B1" under
-- Trading Floor are legitimately different batches.
--
-- Run `npm run db:merge-batches -- --yes` before this if any duplicates exist;
-- creating the index will fail while they do.
CREATE UNIQUE INDEX IF NOT EXISTS "batches_program_name_uq"
  ON "batches" ("program_id", lower(trim("name")));
