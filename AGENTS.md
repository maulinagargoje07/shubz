# AGENTS.md — ShubzTrader indicator admin conventions

Internal admin panel for ShubzTrader (Pune), at crm.shubztrader.com. It shows
who bought the 7 Godfather Strategies TradingView indicator, their purchases
and failed payments, and lets an admin tick "TradingView access given" once a
buyer's username has been added on TradingView. Its dashboard, Customers and
Purchases pages follow the spreadsheet tracker they replaced (one row per
person merged on TradingView username; purchase date + months, less a day, = expiry (the last day of access);
expired / expiring soon (7 days) / active). Read this before writing code.

Until migration 0007 this app was a student CRM (contacts, programs,
enrollments, fees, attendance, messaging). All of that was removed, data
included. Don't bring any of it back by accident from git history.

## Where the data lives

Indicator data is **not** in this app's database. It lives in the
`shubztrader-payments` service (its own repo and Railway project), which takes
the Razorpay AutoPay payments on shubztrader.com. This app reads it through
that service's admin API, from the server only:

- `src/server/indicator/api.ts` — every call to the payments service.
- `PAYMENTS_ADMIN_KEY` (this app) must equal `ADMIN_API_KEY` (payments service).
  It is sent as a Bearer token and never reaches a browser. Never import
  `server/indicator/*` or `lib/env.ts` into a client component.
- `PAYMENTS_API_URL` defaults to the production payments service; it must be
  https outside localhost.
- Two plans are sold: 1 month and 3 months. Each subscriber and purchase
  carries its `plan` (key `1m`/`3m`, name, price, months). Lists filter with
  `plan=1m|3m`.
- **Every figure is computed by the payments service, never here.** Expiry
  dates, days left, access status, the merge into customers, the dashboard's
  three groups (access status today / sales / renewals) and the needs-access /
  needs-removal flags all come from its one set of SQL rules, documented in
  its README under "The dashboard's rules". This app only lays them out. If a
  number looks wrong, fix it there (and its `test/dashboard.test.ts`).
- Dates that are calendar days (`paidThrough`, `validTill`, `expiryDate`,
  `purchaseDate`, `dashboard.today`) arrive as `yyyy-mm-dd` text. Show them
  with `formatDate()`, never `formatIST()`, so no time zone shifts them.
- The one write is the TradingView access tick
  (`server/indicator/actions.ts`). The payments service stores it, on every
  subscription of that customer at once (access belongs to a TradingView
  username, not a subscription); this app writes the audit row after that
  service confirms the change. The Customers page and the dashboard's to-do
  lists tick through the customer's `latestSubscriptionId`.
- If the payments service can't be reached or the key is wrong, Indicator
  pages show `components/indicator/unavailable.tsx`. Sign-in, Team and
  Profile must keep working regardless.

This app's own database holds only sign-in accounts (Better Auth tables) and
the audit log.

## Stack — use exactly this

Next.js 15 (App Router) + TypeScript strict · PostgreSQL on Railway ·
Drizzle ORM + drizzle-kit · Better Auth (email + password, session cookies) ·
Tailwind v4 + shadcn/ui (`base-nova` style, built on Base UI) ·
react-hook-form + zod for every form · date-fns.

**Ask before adding any dependency.** The Excel export is written without a
library (`lib/export/xlsx.ts`) for that reason.

## Rules

1. **Money is integer paise.** The payments API sends paise; `formatINR()` /
   `formatINRShort()` in `lib/money.ts` are the only way money reaches a screen.
   Exports write rupees (`paise / 100`) as numbers.
2. **Time is UTC in data, India on screen.** Use `formatIST()` and
   `todayIST()` from `lib/fy.ts`. Date filters ("This month", from/to) are
   calendar days in India; the payments API interprets them the same way.
3. **Primary keys here are UUID v7** from `newId()` in `lib/ids.ts`.
   Subscribers are keyed by their Razorpay subscription ID (`sub_...`).
4. **Every mutation writes to `audit_log`** via `mutate()` in `lib/audit.ts`,
   inside the same transaction as the change. `audit_log.entity_id` is text so
   it can hold a `sub_...` ID.
5. **Server actions for mutations.** Shape: zod parse → authorise
   (`checkPermission`) → change → audit → `revalidateEverything()`. Zod
   schemas live in `src/lib/validation/` and are shared with the forms.
6. **Migrations are generated and committed.** `npm run db:generate`, review
   the SQL, commit it. Never `drizzle-kit push`. Production applies them with
   `npm run db:migrate` as Railway's pre-deploy command.

## Roles and permissions

Two roles: `SUPERADMIN` and `ADMIN` (`lib/permissions.ts`). Permissions:
`VIEW_INDICATOR`, `MANAGE_TRADINGVIEW_ACCESS`, `EXPORT_DATA`, `MANAGE_USERS`.
Admins get the first three by default; a superadmin can customise any admin
from Team. Roles and permissions are read from the database on every request
(`lib/session.ts`), so a change bites on the next page load. A role the app
doesn't know gets no access at all.

Nobody signs themselves up: Better Auth's sign-up endpoint is disabled
(`disableSignUp` in `lib/auth.ts`). Accounts are created from Team or with
`npm run setup:superadmin`.

## UI conventions

Used on a phone and on a laptop, on Indian mobile networks.

- **Customers and Purchases are Excel-style grids** (`components/grid/grid.tsx`,
  a client component; the columns live in `components/indicator/*-grid.tsx`).
  The page loads the whole list (`fetchAll`) and the grid sorts and filters in
  the browser: click a heading to sort, the funnel on each heading ticks
  values / sets a from-to, filters combine, the bar shows what matched with
  totals and downloads exactly those rows as CSV. Rows are tinted by access
  status like the sheet. The grid scrolls sideways with the first column
  pinned — on these two pages that is the point, the admin asked for a sheet.
  Links into them (`?status=expiring`, `?access=grant`, `?plan=3m`,
  `?repeat=yes`, `?q=`) become the grid's starting filters. Nothing is
  calculated in the grid; it only arranges values the payments service sent.
- **Subscriptions and Failed payments are server components** using
  `DataTable` (`components/data-table/table.tsx`). Each column has a
  `priority` (`primary` always, `secondary` from `sm`, `tertiary` from `lg`);
  below `sm` rows become cards, with an `actions` column in the card footer.
  Their filters and pagination are a plain GET form and plain links
  (`components/data-table/filters.tsx`).
- **The header's Excel/CSV downloads** (`*/export` routes) take the URL's
  filters (`server/indicator/filters.ts`) and walk every page, so on
  Subscriptions and Failed payments they match the screen; on Customers and
  Purchases they are the whole list, and the grid's own button is the filtered one.
- **Status has one visual language:** `StatusPill` tones and
  `subscriptionTone()` in `components/ui/status.tsx`. Don't hand-write
  emerald/rose classes at a call site.
- **Indicator pages keep themselves current:** `AutoRefresh` calls
  `router.refresh()` every 10 seconds while the tab is visible.
- **No `loading.tsx` under `/indicator`.** With Next.js 15.5, a `loading.tsx`
  boundary above a page that fetches data made same-page navigations (filters,
  pagination, Clear) and `router.refresh()` intermittently do nothing.
  Measured, not guessed: about half of those clicks stalled with the boundary,
  none without it. Navigation feedback comes from `LinkPending`
  (`components/layout/link-pending.tsx`) on nav links and tiles instead. Don't
  add a loading.tsx there without re-testing that.
- Phone specifics: bottom tab bar under `lg`, fixed elements pad for
  `env(safe-area-inset-bottom)`, 44px touch targets on coarse pointers
  (global in `globals.css`, `pointer-coarse:` where needed).
- Fonts are the system stack. No webfont.

## Layout

```
drizzle/                 committed migration SQL (0007 removed the student CRM)
scripts/                 migrate.ts, setup-superadmin.ts (run with tsx)
src/db/schema/           enums, auth, ops (audit_log)
src/lib/                 money, fy, ids, env, audit, auth, permissions, session,
                         indicator (types/labels), phone-format, export/, validation/
src/server/indicator/    api (payments service), actions, filters, export
src/server/team|profile/ team management and your own account
src/app/(auth)/          login
src/app/(app)/indicator/ dashboard (page.tsx), customers, payments (the Purchases
                         page; the path is kept), subscribers, failed (+ export routes)
src/app/(app)/settings/  profile, team
src/components/          ui primitives, data-table, layout, indicator
```

## Commands

```
npm run dev               # dev server
npm run build             # production build — must pass before anything is "done"
npm run typecheck         # tsc --noEmit
npm run lint              # eslint
npm run db:generate       # generate a migration from schema changes
npm run db:migrate        # apply pending migrations
npm run setup:superadmin  # create or reset the root superadmin (SUPERADMIN_* in .env)
```

## Environment

`DATABASE_URL` and `BETTER_AUTH_SECRET` are required, validated on first use
by `src/lib/env.ts`. `PAYMENTS_ADMIN_KEY` (and optionally `PAYMENTS_API_URL`)
connect the Indicator pages; without them only those pages say what's missing.
**`.env` is gitignored and must never be committed.**
