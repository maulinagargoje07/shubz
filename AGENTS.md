# AGENTS.md — ShubzTrader platform conventions

Internal student-management and CRM platform for ShubzTrader, a trading
education business in Pune. Read this before writing code. These conventions
are not stylistic preferences; several of them are correctness requirements
that quietly break money, identity, or history if ignored.

## Stack — use exactly this

Next.js 15 (App Router) + TypeScript strict · PostgreSQL on Railway ·
Drizzle ORM + drizzle-kit · Better Auth (email + password, session cookies) ·
Tailwind v4 + shadcn/ui (`base-nova` style, built on Base UI) ·
react-hook-form + zod for every form · date-fns · libphonenumber-js
(server-side only) · papaparse.

Data grids are server-rendered rather than using a client table library — see
UI conventions below for why, and for the column API that replaced it.

One repo, one app. No separate backend, no microservices.

**Ask before adding any dependency.** The current set was approved explicitly.

## The nine rules

### 1. Money is integer paise, always

Every amount is a `BIGINT` column holding **paise**, mapped as
`bigint({ mode: 'number' })`. Never float, never `numeric`, never rupees in the
database.

Rupees exist in exactly two places: text a human typed, and text rendered to a
screen. Both boundaries live in [`src/lib/money.ts`](src/lib/money.ts) —
`toPaise()` on the way in, `formatINR()` on the way out. Nothing else converts.

Use `splitInstallments()` to divide a total; it puts the remainder on the first
instalment so the parts sum back to the total exactly. ₹45,000 split three ways
must still be ₹45,000.

### 2. Phone numbers are canonical E.164

`contacts.phone_e164` is the identity of a contact and is UNIQUE among live
rows. Every write path — form, server action, CSV import — runs `parsePhone()`
from [`src/lib/phone.ts`](src/lib/phone.ts) with default region `IN` before
touching the database. Store `phone_raw` as typed alongside it.

`"9876543210"`, `"+91 98765 43210"` and `"098765-43210"` are one person and
must all become `+919876543210`.

The unique index is **partial** (`WHERE deleted_at IS NULL`), so soft-deleting
a contact releases their number for re-use and import dedupes only against
people who actually exist.

### 3. Time is timestamptz in UTC, displayed in Asia/Kolkata

All timestamps are `timestamp with time zone`, stored UTC. Never store a naive
datetime. Genuine calendar dates (`due_date`, `paid_on`, `start_date`) use
`date` and carry no timezone.

"Today" for business purposes is today **in Pune**. In TypeScript use
`todayIST()` from [`src/lib/fy.ts`](src/lib/fy.ts); in SQL use
`(now() AT TIME ZONE 'Asia/Kolkata')::date`. Using UTC would flip fees to
overdue five and a half hours early.

### 4. Primary keys are UUID v7

Generate with `newId()` from [`src/lib/ids.ts`](src/lib/ids.ts). Never
`gen_random_uuid()`, never v4. v7 sorts chronologically, which gives index
locality on insert and a free creation order.

Ids are generated in the application because Postgres only gained native
`uuidv7()` in v18 and Railway runs 16/17.

### 5. Soft delete on contacts, enrollments, payments

Set `deleted_at`; never `DELETE`. Every read filters `deleted_at IS NULL`.
Financial records are never hard-deleted — a wrong payment is soft-deleted and
re-recorded, so the ledger still explains how a balance came to be.

### 6. Every mutation writes to audit_log

Actor, action, entity, entity_id, before/after JSON — written **in the same
transaction as the change**. If the change rolls back so does its audit row;
the log can never claim something happened that didn't. Use `withAudit()`.

### 7. Server actions for mutations. No client-side DB access

Shape: `zod.parse` → authorise → transaction → audit → `revalidatePath`.
Zod schemas live in `src/lib/validation/` and are **shared** between the client
form and the server action, so validation cannot diverge.

### 8. Balance is never a stored column

Read `enrollment_balances` (the view, see below). A stored balance drifts the
first time a payment is corrected.

### 9. Migrations are generated and committed

`npm run db:generate` then commit the SQL. **Never `drizzle-kit push` after the
first deploy.** What runs against production is the reviewed SQL in `drizzle/`.

## Data model notes that are easy to get wrong

**One contacts table.** Leads, webinar registrants and paying students all live
in `contacts`, distinguished by `lifecycle_stage`. There is deliberately no
students table — the Students page is a filtered view. A lead who pays becomes
a `STUDENT` by UPDATE, keeping their notes, history and messages.

**`programs.type` and `programs.delivery_mode` are two separate columns.**
Never collapse them into one enum. The queries "all mentorship regardless of
mode" and "everyone who attends offline" must both be answerable without string
matching. The UI presents them as one combined selector of seven options and
writes both columns; `programLabel()` renders `"Mentorship (Offline)"`
everywhere a program appears.

**Batches are conditional on delivery mode.** ONLINE requires `meeting_link`,
OFFLINE requires `venue_name`. Enforced in the zod schema via `superRefine`;
the form shows one branch or the other, never both.

**Consent is derived, not stored.** `consent_events` is append-only; opt-in
status is the latest event per (contact, channel). There is no boolean column —
a boolean would discard when someone consented and to what wording, which is
the entire point of a consent record.

**`fee_total_paise` on a RECURRING enrollment is ONE cycle's fee**, not a
contract total. Cycles materialise as `payment_schedule` rows that roll forward
as they are paid. This gives one-time and recurring enrollments a single
overdue rule — an unpaid schedule row past its due date — and lets an
open-ended membership exist without an invented total.

**`messages` is one table for inbound and outbound**, discriminated by
`direction`. Not two. A conversation is one ordered stream, and the 24-hour
service window depends on the last INBOUND message.

**Sends are idempotent by construction.** `messages.idempotency_key` is
generated client-side before the send and is UNIQUE, so a retry cannot produce
a second WhatsApp message. `wamid` is Meta's id — unique, nullable until Meta
accepts.

**Naming:** the auth session table is exported as `authSessions`; class
sessions are `classSessions`. Two exports named `sessions` collide as an
ambiguous star export in `schema/index.ts` and one silently disappears from the
generated migration. This has already happened once.

## UI conventions

The app is used daily on a phone at a desk and on a laptop, on Indian mobile
networks. Weight and touch ergonomics are requirements, not polish.

**Lists are server components.** Every grid is server-driven — the server
filters, sorts and paginates — so there is no client table library. Use
`DataTable` from `components/data-table/table.tsx` and give each column a
`priority`:

| priority | desktop | mobile |
| --- | --- | --- |
| `primary` | always | card title / first line |
| `secondary` | from `sm` | card metadata |
| `tertiary` | from `lg` | hidden |

Below `sm` the same rows render as stacked cards. Never solve a wide table by
scrolling it sideways — the reader loses the row they were on.

**Filters and pagination are a plain GET form and plain links**
(`components/data-table/filters.tsx`). They work before hydration, and native
`<select>` gives phones the OS wheel picker. Do not reach for a client-side
filter component.

**Money state has one visual language.** Use `StatusPill` with the `paid` /
`pending` / `overdue` tones from `components/ui/status.tsx`, and the
`scheduleTone` / `enrollmentTone` / `lifecycleTone` / `attendanceTone` helpers.
Never hand-write emerald/rose classes at a call site — that is how two pages
end up disagreeing about what "overdue" looks like.

**Keep libphonenumber-js off the client.** The shared zod schemas check shape
only, via `lib/phone-format.ts`. Server actions run `parsePhone()` from
`lib/phone.ts` to normalise. Importing `lib/phone.ts` into a client component
pulls ~150 kB of country metadata into that bundle.

**Mobile specifics**
- Bottom tab bar is primary navigation under `lg`; the sidebar is desktop only.
- Fixed bottom elements need `env(safe-area-inset-bottom)` padding.
- Amount fields take `inputMode="decimal"`, phones `type="tel"`.
- Form actions stack full-width below `sm`.
- Touch targets are 44px on coarse pointers (handled globally in `globals.css`).

**Every route has a `loading.tsx`.** Pages are dynamic and hit Postgres, so a
navigation costs a round-trip; without a skeleton the app reads as broken
rather than busy. Use the helpers in `components/skeletons.tsx`.

**Fonts are the system stack.** No webfont — it would cost a render-blocking
request and a layout shift on every cold load.

## Receipt numbers

`ST-<fy>-<6 digits>`, e.g. `ST-2026-000123`. `<fy>` is the **Indian financial
year start** — FY 2026-27 runs 1 Apr 2026 to 31 Mar 2027, so a receipt issued
in Feb 2027 still reads `ST-2026-…`. The counter resets each 1 April and one
financial year forms a contiguous block for the accountant.

Generated inside the recording transaction under `pg_advisory_xact_lock` keyed
on the financial year, so two concurrent payments cannot take the same number.

## enrollment_balances

Defined in [`drizzle/0001_enrollment_balances_view.sql`](drizzle/0001_enrollment_balances_view.sql),
declared for typed reads in [`src/db/views.ts`](src/db/views.ts) with
`.existing()` so drizzle-kit does not try to manage it.

Columns: `enrollment_id`, `fee_total_paise`, `discount_paise`,
`net_payable_paise`, `total_paid_paise`, `balance_due_paise`, `is_overdue`,
`days_overdue`, `next_due_date`, `next_due_amount_paise`.

**Changing the view means editing the SQL and `views.ts` together** — the
column list is the contract between them. Add a new numbered migration that
does `CREATE OR REPLACE VIEW`; never edit an applied migration.

## Layout

```
drizzle/              committed migration SQL
scripts/              migrate.ts, seed.ts  (run with tsx)
src/db/schema/        enums, auth, contacts, catalogue, enrollment, ops, messaging
src/db/index.ts       pg Pool + drizzle client, cached across HMR
src/db/views.ts       enrollment_balances, typed
src/lib/              money, phone, ids, fy, env, audit, auth, validation/, messaging/
src/app/(auth)/       login
src/app/(app)/        protected shell + all feature routes
src/components/ui/    shadcn primitives
```

## Commands

```
npm run dev          # dev server
npm run build        # production build — must pass before any step is "done"
npm run typecheck    # tsc --noEmit
npm run db:generate  # generate a migration from schema changes
npm run db:migrate   # apply pending migrations
npm run db:seed      # seed demo data (idempotent)
```

## Environment

`DATABASE_URL` and `BETTER_AUTH_SECRET` are required and validated at startup
by [`src/lib/env.ts`](src/lib/env.ts). **`.env` is gitignored and must never be
committed.** In production Railway injects `DATABASE_URL`; for local
development use the Postgres service's public proxy URL.

## Working method

Build in the numbered order of the spec. After each numbered item, stop, report
what was built, and wait for confirmation. Run the build and verify it compiles
before claiming an item is done. Ask rather than assume.
