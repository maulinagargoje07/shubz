# ShubzTrader — indicator admin

The admin panel at crm.shubztrader.com for the 7 Godfather Strategies
TradingView indicator:

- **Overview** — active subscribers, money collected this month and in total,
  who is waiting for TradingView access, who should lose it, and failed
  payments to follow up. Updates itself every 10 seconds.
- **Subscribers** — everyone who paid, with the **TradingView access given**
  tick, search and filters.
- **Payments** — every successful charge, with month and date filters.
- **Failed payments** — declined checkout attempts, with Razorpay's reason and
  whether the buyer paid later.
- **Excel and CSV downloads** on each list, matching the filters on screen.
- **Team** — the superadmin adds admins and decides what they can do.

The subscribers and payments themselves live in the `shubztrader-payments`
service, which runs the Razorpay checkout; this app reads them through its
admin API. Conventions are in [AGENTS.md](AGENTS.md).

## Settings (Railway → this service → Variables)

| Variable | |
| --- | --- |
| `DATABASE_URL` | Reference to this project's Postgres |
| `BETTER_AUTH_SECRET` | Signs session cookies (`openssl rand -base64 32`) |
| `BETTER_AUTH_URL` | `https://crm.shubztrader.com` |
| `PAYMENTS_ADMIN_KEY` | The same value as `ADMIN_API_KEY` on shubztrader-payments |
| `PAYMENTS_API_URL` | Optional; defaults to the production payments service |

Set the service's **Pre-deploy command** to `npm run db:migrate`, so each
deploy applies new migrations before it starts.

## Local development

```bash
cp .env.example .env      # fill in DATABASE_URL, BETTER_AUTH_SECRET, PAYMENTS_ADMIN_KEY
npm install
npm run db:migrate
npm run dev
```

Create or reset the root superadmin with `SUPERADMIN_EMAIL`,
`SUPERADMIN_PASSWORD` (and optionally `SUPERADMIN_NAME`) in `.env`, then
`npm run setup:superadmin`.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate a migration from schema changes |
| `npm run db:migrate` | Apply pending migrations |
| `npm run setup:superadmin` | Create or reset the root superadmin |
| `npm run db:studio` | Drizzle Studio |

`.env` is gitignored and must never be committed.
