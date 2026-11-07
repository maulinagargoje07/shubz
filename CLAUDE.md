# CLAUDE.md — ShubzSystems (crm.shubztrader.com, the indicator admin)

Handoff written 4 Nov 2026 from the chat in which the Coupons page, the plan
pill, the liquid-glass theme and the charts dashboard were built.
**Read `AGENTS.md` next** — it holds the conventions (where the data lives,
money and time rules, permissions, the UI conventions, the chart and theme
notes) and is kept accurate. The other two repos have their own CLAUDE.md:
`~/Desktop/shubztrader-payments` (the payment service, whose README is the
spec for every figure shown here) and `~/Desktop/ShubzTrader` (the website).

## Working rules (from the owner — keep them)

- Never read, print, paste or commit `.env`, `DATABASE_URL`,
  `BETTER_AUTH_SECRET` or `PAYMENTS_ADMIN_KEY`. Don't ask the owner to share
  them. Variable names are in `README.md` → Settings; values live only in
  Railway → this service → Variables. Nothing from `server/` or `lib/env.ts`
  may reach a client component.
- Don't commit, push or deploy unless the owner says so. The owner pushes to
  GitHub themselves; Railway deploys from the push (migrations run as the
  pre-deploy command).
- Keep changes minimal and reversible. Don't invent IDs, credentials, SDK
  functions or test results. `npm run build` must pass before anything is "done".
- Every figure on screen comes from the payment service; this app only lays
  it out (the dashboard charts add up its purchase rows, nothing more). If a
  number looks wrong, the fix is in the service, not here.
- Ask before adding any dependency (the Excel export and the charts are
  written without one for that reason).

## What it is

Next.js 15 (App Router), TypeScript strict, Tailwind v4 + shadcn (Base UI),
Better Auth (email + password; nobody self-registers), Drizzle on Postgres
(Railway). Its own database holds only sign-in accounts and the audit log;
subscribers, payments, customers, failed payments and coupons are read from
the payment service's admin API (`src/server/indicator/api.ts`, Bearer
`PAYMENTS_ADMIN_KEY` = the service's `ADMIN_API_KEY`). Pages under
`/indicator` refresh themselves every 10 seconds.

Pages: Dashboard (`/indicator`), Customers, Purchases (`/indicator/payments`),
Subscriptions, Failed payments, Coupons, Meetup, Team, Your profile. Roles SUPERADMIN
and ADMIN; permissions `VIEW_INDICATOR`, `MANAGE_TRADINGVIEW_ACCESS`,
`EXPORT_DATA`, `MANAGE_COUPONS` (admins don't get it by default), `MANAGE_USERS`.

## The Diwali offer, from this side

- Coupons page: the "Diwali offer" card (DIWALI20 = 20% off the 1-month plan,
  DIWALI30 = 30% off the 3-month plan) with one Switch off / Switch on button,
  each code's own switch, and "Register Razorpay offer" for the offer IDs
  (plan + method + discount, per mode). The four offers exist in Test and
  Live and are registered.
- **Still to do in the UI (owner):** set "Valid until 2026-11-20" on both
  codes if it isn't already — the service's seed doesn't rewrite existing codes.
- After 20 Nov 2026: switch the offer off here (the website's page and pop-up
  follow by themselves), then the website's footer link and pop-up mount can
  be removed.

## Meetup page (added 8 Nov 2026, uncommitted)

- `/indicator/meetup` for the Pune Forex Traders Meetup (Fri 4 Dec 2026,
  Conrad Pune, ₹999): tiles, registrations-by-day area chart and calendar,
  experience ring, cities, the registrations grid, a three-tile section on
  the dashboard, nav entry. Data from the payments service's new
  `GET /api/admin/meetup`; see AGENTS.md → "Meetup registrations".
- Verified: `npm run typecheck`, `npm run lint`,
  `NEXT_DIST_DIR=.next-check npm run build` pass. Not opened in a browser
  (needs the owner's sign-in).
- Until the payments service is pushed with the endpoint, the page says the
  service needs updating and the dashboard leaves the section out. The
  owner's pending Razorpay/Railway steps are listed in the payments service's
  CLAUDE.md.

## State on 4 Nov 2026 — uncommitted work, under review by the owner

Working tree: 20 modified files + `src/components/charts/`,
`src/components/indicator/purchase-pulse.tsx`, `src/components/layout/backdrop.tsx`,
`src/components/ui/glass.tsx`, `src/lib/chart-data.ts` new. Nothing pushed.
Together they are:

1. **Liquid-glass theme** over a colourful wallpaper (`globals.css` tokens,
   `.glass` / `.glass-tint` / `.glass-bar`, `Backdrop`), with a light variant
   under the avatar menu. Header, sidebar, phone tab bar, tables, grids,
   sign-in page all on it.
2. **Charts dashboard** (`src/app/(app)/indicator/page.tsx`): headline tiles
   with sparklines and vs-last-month deltas, Collections (30 days / 12 months),
   Plan mix, New buyers and renewals, Payment methods, Renewals ring, Access
   status bar, To do, the action lists, latest purchases/failures with a toast
   when a new purchase lands. Series from `src/lib/chart-data.ts`.
3. **Plan pill** (`PlanPill` in `cells.tsx`) next to the access tick in the
   "Give access" / "Remove access" lists.
4. **Fee figures hidden** everywhere by `SHOW_FEE_FIGURES` in `src/lib/indicator.ts`
   (dashboard tile, Purchases column, export columns). Flip to bring them back.

Verified before handoff: `npm run typecheck` clean (ignore errors from a
stale `.next-check/` folder, it is gitignored), `npm run lint` clean, a
35-check browser run (sign-in, tiles, charts and tooltips, access tick with
audit rows, live refresh, grids, exports, coupons, permissions, phone layout)
passing, no console errors. Last commit: `0034363` "Coupons page with the
Diwali offer switch".

## Commands

```
npm run dev              # http://localhost:3000 (needs .env with DATABASE_URL, BETTER_AUTH_SECRET, PAYMENTS_ADMIN_KEY)
npm run build            # must pass
npm run typecheck
npm run lint
npm run db:generate      # migration from schema changes — review the SQL, commit it; never drizzle-kit push
npm run db:migrate
npm run setup:superadmin
```

For local work against a local payment service set `PAYMENTS_API_URL`
(http is allowed only for localhost). There is no test suite in this repo;
the 35-check Playwright run lived in the cloud workspace with a seeded local
payment service. Porting it is a sensible next task.
