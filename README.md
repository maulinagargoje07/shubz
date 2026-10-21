# ShubzTrader — indicator admin

The admin panel at crm.shubztrader.com for the 7 Godfather Strategies
TradingView indicator:

- **Dashboard** — laid out like the spreadsheet tracker it replaced:
  *Access status today* (active, expiring within 7 days, expired – access can
  be removed, rows needing a check, total customers merged on TradingView
  username), *Sales* (purchases, 1- and 3-month plans sold, collected, net
  earned after Razorpay fees, this month), *Renewals* (customers who renewed,
  renewal rate, average paid per customer), then the to-do lists: who is
  waiting for TradingView access, who should lose it, who is about to run out,
  and failed payments to follow up. Updates itself every 10 seconds.
- **Customers** — one row per person, repeat purchases merged: purchases,
  latest plan, first and latest purchase, **access valid till** (the latest
  expiry across all their purchases), days left, colour status, WhatsApp link,
  total paid, and the **TradingView access given** tick.
- **Purchases** — every successful charge (first payments and AutoPay
  renewals) with the sheet's calculated columns: plan, expiry date, days left,
  status, which purchase it is for that customer. Month, date, plan, status
  and repeat-buyer filters.
- **Subscriptions** — every Razorpay AutoPay subscription and its status.
- **Failed payments** — declined checkout attempts, with Razorpay's reason and
  whether the buyer paid later.
- **Excel and CSV downloads** on each list, matching the filters on screen.
- **Team** — the superadmin adds admins and decides what they can do.

Every figure is computed by the payments service with one set of rules (its
README, "The dashboard's rules"); this app only lays them out.

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
