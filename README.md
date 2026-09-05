# ShubzTrader — Student Management + CRM

Internal platform for ShubzTrader (Pune): contacts, programs, batches,
sessions, enrollments, fees and receipts, attendance, and CSV import.

Conventions live in [AGENTS.md](AGENTS.md). Read that before writing code —
several rules there (integer paise, E.164 phones, timestamptz, never storing a
balance) are correctness requirements, not preferences.

## Setting up the database

The app and its Postgres live in ONE Railway project.

1. Go to [railway.app](https://railway.app) → **New Project**.
2. **+ New** → **Database** → **Add PostgreSQL**.
3. Open the Postgres service → **Variables** tab.
4. Copy **`DATABASE_PUBLIC_URL`** — the public proxy endpoint, used for local
   development. It looks like:
   ```
   postgresql://postgres:PASSWORD@shinkansen.proxy.rlwy.net:12345/railway
   ```

Then locally:

```bash
cp .env.example .env
# paste the URL into DATABASE_URL
# generate a session secret:
openssl rand -base64 32   # paste into BETTER_AUTH_SECRET

npm install
npm run db:migrate        # creates all tables + the enrollment_balances view
npm run db:seed           # demo programs, batches, contacts, payments
npm run dev
```

When the app is later deployed to the same Railway project, add
`DATABASE_URL` as a **service reference variable** pointing at the Postgres
service so it uses the internal network (`postgres.railway.internal`) rather
than the public proxy.

`.env` is gitignored and must never be committed.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:generate` | Generate a migration from schema changes |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:seed` | Seed demo data (idempotent) |
| `npm run db:backup` | Dump every business table to `backups/*.json` |
| `npm run db:reset -- --yes` | Clear all business data, keep logins, provision the four programs |
| `npm run db:studio` | Drizzle Studio |

Migrations are generated and committed. `drizzle-kit push` is never used after
the first deploy.

## Starting fresh

To clear demo data and begin entering real records:

```bash
npm run db:backup            # writes backups/backup-<timestamp>.json
npm run db:reset -- --yes    # clears everything except your login
```

`db:reset` refuses to run without `--yes`. It preserves the auth tables, so
you are not locked out, and provisions the four programs the student-record
form offers (Mentorship Online/Offline, Trading Floor Online/Offline).

Backups contain real contact details and are gitignored. Keep them somewhere
private.
# shubz
