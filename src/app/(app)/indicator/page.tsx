import Link from "next/link"
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CircleAlert,
  IndianRupee,
  ShoppingBag,
  UserCheck,
  UserX,
  Users,
} from "lucide-react"

import { ChartCard } from "@/components/charts/chart-card"
import { SERIES, STATUS } from "@/components/charts/palette"
import { RankedBars } from "@/components/charts/ranked-bars"
import { RingMeter } from "@/components/charts/ring-meter"
import { SalesCharts } from "@/components/charts/sales-charts"
import { SegmentedBar, type Part } from "@/components/charts/segmented-bar"
import { DataTable, type Column } from "@/components/data-table/table"
import { DeniedNotice } from "@/components/denied-notice"
import { AccessToggle } from "@/components/indicator/access-toggle"
import { BuyerCell, ContactCell, PlanPill, SubscriptionStatus, TradingViewCell, ValidTill, When } from "@/components/indicator/cells"
import { PurchasePulse } from "@/components/indicator/purchase-pulse"
import { IndicatorToolbar } from "@/components/indicator/toolbar"
import { IndicatorUnavailable } from "@/components/indicator/unavailable"
import { PageHeader, SectionHeading } from "@/components/page-header"
import { EmptyState, StatTile, StatusPill, type Delta } from "@/components/ui/status"
import { buildChartData, changeRatio, type ChartData } from "@/lib/chart-data"
import { formatDate, formatIST, todayIST, toISTDateString } from "@/lib/fy"
import {
  planLabel,
  planName,
  SHOW_FEE_FIGURES,
  type Customer,
  type Dashboard,
  type FailedPayment,
  type IndicatorOverview,
  type Payment,
} from "@/lib/indicator"
import { formatINR, formatINRShort } from "@/lib/money"
import { can } from "@/lib/permissions"
import type { RawParam } from "@/lib/search-params"
import { requirePermissionPage } from "@/lib/session"
import { fetchAll, getOverview, listPayments, PaymentsApiError } from "@/server/indicator/api"
import { fromRecord, hrefWith, modeParam } from "@/server/indicator/filters"

export const dynamic = "force-dynamic"
export const metadata = { title: "Dashboard" }

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const percent = (ratio: number) => `${(ratio * 100).toFixed(1)}%`

/**
 * The dashboard. Every figure comes from the payments service, which works
 * them out with one set of rules (see its README); the charts only add up
 * the purchase rows it sends by day, month, plan and method (lib/chart-data).
 * The page refreshes itself every 10 seconds, so what is on screen is live.
 *
 * Laid out top to bottom: the headline figures with their trend, the sales
 * charts, access status today, what needs doing, then the lists to act on.
 */
export default async function IndicatorOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, RawParam>>
}) {
  const user = await requirePermissionPage("VIEW_INDICATOR")
  const raw = await searchParams
  const requestedMode = modeParam(fromRecord(raw))

  let data: IndicatorOverview
  let purchases: Payment[] | null
  try {
    // The overview and every purchase row (for the charts), side by side. The
    // charts are optional: if the list can't be read the figures still show.
    const [overview, all] = await Promise.all([
      getOverview(requestedMode),
      fetchAll((page) => listPayments({ mode: requestedMode, ...page })).catch(() => null),
    ])
    data = overview
    purchases = all?.rows ?? null
  } catch (error) {
    if (!(error instanceof PaymentsApiError)) throw error
    return (
      <div className="pb-8">
        <PageHeader title="Dashboard" description="7 Godfather Strategies subscribers and payments." />
        <DeniedNotice show={raw.denied === "1"} />
        <IndicatorUnavailable error={error} />
      </div>
    )
  }

  const canTick = can(user, "MANAGE_TRADINGVIEW_ACCESS")
  // Links keep the mode only when it isn't the one the checkout runs in.
  const mode = data.mode === data.serviceMode ? undefined : data.mode
  const link = (path: string, params: Record<string, string | undefined> = {}) =>
    hrefWith(path, { ...params, mode })

  const monthName = data.revenue.monthStart ? formatIST(data.revenue.monthStart, "MMMM") : "this month"
  const monthFrom = data.revenue.monthStart ? toISTDateString(new Date(data.revenue.monthStart)) : undefined
  // The plans on sale. An older payments service reports a single `plan`.
  const plans = data.plans ?? (data.plan ? [{ key: "1m", ...data.plan, available: true, error: null }] : [])
  const onSale = plans.filter((p) => p.available && p.amountPaise !== undefined)
  const notOnSale = plans.filter((p) => !p.available)

  const dash: Dashboard | undefined = data.dashboard
  const expiring = data.latest.expiring ?? []
  const charts: ChartData | null = dash && purchases ? buildChartData(purchases, dash.today) : null

  const accessColumns: Column<Customer>[] = [
    {
      id: "buyer",
      header: "Customer",
      priority: "primary",
      cell: (row) => <BuyerCell name={row.fullName} email={row.email} />,
    },
    {
      // Which plan they bought, right next to the name and the tick, so the
      // admin knows what to give before opening TradingView.
      id: "plan",
      header: "Plan",
      priority: "primary",
      align: "right",
      hideLabelOnCard: true,
      cell: (row) => <PlanPill plan={row.latestPlan} className="items-end" />,
    },
    {
      id: "tradingview",
      header: "TradingView",
      priority: "secondary",
      cell: (row) => <TradingViewCell id={row.tradingviewId} />,
    },
    {
      id: "contact",
      header: "Contact",
      priority: "tertiary",
      cell: (row) => <ContactCell phone={row.contactNumber} />,
    },
    {
      id: "paid",
      header: "Paid",
      priority: "secondary",
      cell: (row) => <When iso={row.lastPaymentAt ?? row.firstSeenAt} pattern="d MMM, h:mm a" />,
    },
    {
      id: "actions",
      header: "TradingView access",
      align: "right",
      cell: (row) => <Toggle row={row} canEdit={canTick} />,
    },
  ]

  const removalColumns: Column<Customer>[] = [
    accessColumns[0],
    accessColumns[1],
    accessColumns[2],
    {
      id: "status",
      header: "Status",
      priority: "secondary",
      cell: (row) => (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <SubscriptionStatus status={row.subscriptionStatus} />
          {row.validTill ? (
            <span className="text-xs text-muted-foreground">paid until {formatDate(row.validTill, "d MMM")}</span>
          ) : null}
        </span>
      ),
    },
    accessColumns[5],
  ]

  const expiringColumns: Column<Customer>[] = [
    {
      id: "buyer",
      header: "Customer",
      priority: "primary",
      cell: (row) => <BuyerCell name={row.fullName} email={row.email} />,
    },
    {
      id: "validTill",
      header: "Access valid till",
      priority: "primary",
      align: "right",
      hideLabelOnCard: true,
      cell: (row) => <ValidTill date={row.validTill} daysLeft={row.daysLeft} />,
    },
    {
      id: "tradingview",
      header: "TradingView",
      priority: "secondary",
      cell: (row) => <TradingViewCell id={row.tradingviewId} />,
    },
    {
      id: "plan",
      header: "Plan",
      priority: "secondary",
      cell: (row) => (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <span>{planName(row.latestPlan)}</span>
          <SubscriptionStatus status={row.subscriptionStatus} />
        </span>
      ),
    },
    {
      id: "actions",
      header: "WhatsApp",
      align: "right",
      cell: (row) => <ContactCell phone={row.contactNumber} />,
    },
  ]

  // How this month compares with last month, for the two month tiles.
  const monthDelta = (pick: (totals: { collectedPaise: number; purchases: number }) => number): Delta | undefined =>
    charts ? { ratio: changeRatio(pick(charts.thisMonth), pick(charts.lastMonth)), vs: charts.lastMonth.name } : undefined

  return (
    <div className="pb-8">
      <PageHeader
        title="Dashboard"
        description={
          onSale.length > 0
            ? `${onSale.map((p) => `${planLabel(p)} ${formatINRShort(p.amountPaise ?? 0)}`).join(" · ")}, renewed by AutoPay`
            : "7 Godfather Strategies subscribers and payments."
        }
      />
      <DeniedNotice show={raw.denied === "1"} />
      {notOnSale.length > 0 ? (
        <div className="px-4 pt-4 sm:px-6">
          <p
            role="status"
            className="glass-tint flex items-start gap-2.5 rounded-2xl border-pending/40 bg-pending-muted px-4 py-3 text-sm text-pending-foreground"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {notOnSale.map((p) => (
                <span key={p.key} className="block">
                  The {planName(p)} can&apos;t be bought right now{p.error ? `: ${p.error}` : "."}
                </span>
              ))}
            </span>
          </p>
        </div>
      ) : null}
      <IndicatorToolbar path="/indicator" mode={data.mode} serviceMode={data.serviceMode} generatedAt={data.generatedAt} />
      <PurchasePulse
        payments={data.latest.payments.map((p) => ({
          paymentId: p.paymentId,
          fullName: p.fullName,
          amountPaise: p.amountPaise,
          plan: p.plan ? planName(p.plan) : null,
          renewal: (p.purchaseNumber ?? 1) > 1,
        }))}
      />

      {dash ? (
        <>
          {/* ------------------------------------------------- Headline figures */}
          <section className="px-4 pt-5 sm:px-6">
            <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile
                label="Total collected"
                value={formatINRShort(dash.sales.collectedPaise)}
                icon={<IndianRupee className="size-4" />}
                hint={
                  charts
                    ? `${formatINRShort(charts.last30Days.collectedPaise)} in the last 30 days · ${plural(dash.sales.purchases, "purchase")} in all`
                    : `${plural(dash.sales.purchases, "purchase")}: first payments and renewals`
                }
                trend={charts?.days.map((d) => d.collectedPaise)}
                href={link("/indicator/payments")}
              />
              <StatTile
                label="Total purchases"
                value={dash.sales.purchases}
                icon={<ShoppingBag className="size-4" />}
                hint={
                  <>
                    {dash.sales.oneMonth} × 1 month · {dash.sales.threeMonths} × 3 months
                    {dash.sales.otherPlans > 0 ? ` · ${plural(dash.sales.otherPlans, "purchase")} on another plan` : ""}
                  </>
                }
                trend={charts?.days.map((d) => d.purchases)}
                trendColor={SERIES.blue}
                href={link("/indicator/payments")}
              />
              <StatTile
                label={`Collected in ${monthName}`}
                value={formatINRShort(dash.sales.thisMonth.collectedPaise)}
                icon={<IndianRupee className="size-4" />}
                delta={monthDelta((t) => t.collectedPaise)}
                hint={charts ? `${formatINRShort(charts.lastMonth.collectedPaise)} in ${charts.lastMonth.name}` : undefined}
                href={link("/indicator/payments", { from: monthFrom, to: todayIST() })}
              />
              <StatTile
                label={`Purchases in ${monthName}`}
                value={dash.sales.thisMonth.purchases}
                icon={<ShoppingBag className="size-4" />}
                delta={monthDelta((t) => t.purchases)}
                hint={
                  data.subscribers.withCouponThisMonth
                    ? `${plural(data.subscribers.withCouponThisMonth, "new subscription")} with a coupon`
                    : charts
                      ? `${plural(charts.lastMonth.purchases, "purchase")} in ${charts.lastMonth.name}`
                      : undefined
                }
                href={link("/indicator/payments", { from: monthFrom, to: todayIST() })}
              />
            </div>
          </section>

          {/* ------------------------------------------------------------ Sales */}
          <section className="px-4 pt-7 sm:px-6">
            <SectionHeading>Sales</SectionHeading>
            {charts ? (
              <SalesCharts
                days={charts.days}
                months={charts.months}
                planMix={<PlanMix charts={charts} dash={dash} link={link} />}
                methods={<Methods charts={charts} />}
                renewals={<Renewals dash={dash} link={link} />}
              />
            ) : (
              <div className="stagger grid grid-cols-1 gap-4 lg:grid-cols-3">
                <p className="glass-tint flex items-start gap-2.5 rounded-2xl border-pending/40 bg-pending-muted px-4 py-3 text-sm text-pending-foreground lg:col-span-2">
                  <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>The purchase list couldn&apos;t be read just now, so the charts are resting. They come back on the next refresh.</span>
                </p>
                <Renewals dash={dash} link={link} />
              </div>
            )}
          </section>

          {/* ---------------------------------------------- Access status today */}
          <section className="px-4 pt-7 sm:px-6">
            <SectionHeading
              action={
                <span className="text-xs text-muted-foreground">
                  Today <span className="font-medium text-foreground">{formatDate(dash.today, "d MMM yyyy")}</span> (India)
                </span>
              }
            >
              Access status today
            </SectionHeading>
            <AccessSplit dash={dash} link={link} />
            <div className="stagger mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
              <StatTile
                compact
                label="Active subscribers"
                value={dash.access.active}
                tone={dash.access.active > 0 ? "paid" : undefined}
                icon={<Users className="size-3.5" />}
                hint="More than 7 days left"
                href={link("/indicator/customers", { status: "active" })}
              />
              <StatTile
                compact
                label="Expiring within 7 days"
                value={dash.access.expiring}
                icon={<CalendarClock className="size-3.5" />}
                hint={dash.access.expiring > 0 ? "Time to ask for a renewal" : "Nobody is about to run out"}
                href={link("/indicator/customers", { status: "expiring" })}
              />
              <StatTile
                compact
                label="Expired – remove access"
                value={dash.access.expired}
                tone={dash.access.expired > 0 ? "overdue" : undefined}
                icon={<UserX className="size-3.5" />}
                hint={dash.access.expired > 0 ? "Paid time has run out" : "Nobody has lapsed"}
                href={link("/indicator/customers", { status: "expired" })}
              />
              <StatTile
                compact
                label="Rows needing a check"
                value={dash.access.check}
                tone={dash.access.check > 0 ? "overdue" : undefined}
                icon={<CircleAlert className="size-3.5" />}
                hint={dash.access.check > 0 ? "Plan unknown, so no expiry" : "Every plan is known"}
                href={link("/indicator/customers", { status: "check" })}
              />
              <StatTile
                compact
                label="Total customers"
                value={dash.access.customers}
                icon={<Users className="size-3.5" />}
                hint={`Merged on TradingView username · ${plural(data.subscribers.total, "subscription")}`}
                href={link("/indicator/customers")}
              />
            </div>
          </section>

          {SHOW_FEE_FIGURES ? (
            <section className="px-4 pt-7 sm:px-6">
              <SectionHeading>After fees</SectionHeading>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile
                  label="Net earned (after fees)"
                  value={formatINRShort(dash.sales.netEarnedPaise)}
                  icon={<IndianRupee className="size-4" />}
                  hint={
                    dash.sales.feeKnownFor < dash.sales.purchases
                      ? `Razorpay's fee known for ${dash.sales.feeKnownFor} of ${dash.sales.purchases}; the rest counted in full`
                      : "After Razorpay's fees"
                  }
                  href={link("/indicator/payments")}
                />
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <div className="px-4 pt-4 sm:px-6">
          <p className="glass-tint flex items-start gap-2.5 rounded-2xl border-pending/40 bg-pending-muted px-4 py-3 text-sm text-pending-foreground">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>The payments service needs updating before the dashboard figures can show here.</span>
          </p>
        </div>
      )}

      {/* ------------------------------------------------------------- To do */}
      <section className="px-4 pt-7 sm:px-6">
        <SectionHeading>To do</SectionHeading>
        <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatTile
            label="Give TradingView access"
            value={data.access.needsAccess}
            tone={data.access.needsAccess > 0 ? "overdue" : undefined}
            icon={<UserCheck className="size-4" />}
            hint={data.access.needsAccess > 0 ? "Paid, waiting for access" : "Everyone who paid has access"}
            href={link("/indicator/customers", { access: "grant" })}
          />
          <StatTile
            label="Remove TradingView access"
            value={data.access.needsRemoval}
            tone={data.access.needsRemoval > 0 ? "overdue" : undefined}
            icon={<UserX className="size-4" />}
            hint={data.access.needsRemoval > 0 ? "Stopped paying, still ticked" : "Nothing to remove"}
            href={link("/indicator/customers", { access: "remove" })}
          />
          <StatTile
            label="Failed payments to follow up"
            value={data.failed.unrecovered}
            icon={<CircleAlert className="size-4" />}
            hint={`${plural(data.failed.last7Days, "failure")} in the last 7 days · ${plural(data.subscribers.pending, "renewal")} being retried`}
            href={link("/indicator/failed", { recovered: "no" })}
          />
        </div>
      </section>

      <section className="mt-8">
        <div className="px-4 sm:px-6">
          <SectionHeading
            action={
              data.access.needsAccess > data.latest.needsAccess.length ? (
                <SeeAll href={link("/indicator/customers", { access: "grant" })} count={data.access.needsAccess} />
              ) : undefined
            }
          >
            Waiting for TradingView access
          </SectionHeading>
          <p className="-mt-1.5 mb-3 text-sm text-muted-foreground">
            Add each username to the indicator on TradingView, then tick <strong className="text-foreground">Access given</strong>.
          </p>
        </div>
        {data.latest.needsAccess.length === 0 ? (
          <div className="px-4 sm:px-6">
            <EmptyState
              icon={<BadgeCheck className="size-5" />}
              title="All caught up"
              description="Everyone who has paid has TradingView access."
            />
          </div>
        ) : (
          <DataTable columns={accessColumns} rows={data.latest.needsAccess} rowKey={(row) => row.customerKey} />
        )}
      </section>

      {data.latest.needsRemoval.length > 0 ? (
        <section className="mt-8">
          <div className="px-4 sm:px-6">
            <SectionHeading
              action={
                data.access.needsRemoval > data.latest.needsRemoval.length ? (
                  <SeeAll href={link("/indicator/customers", { access: "remove" })} count={data.access.needsRemoval} />
                ) : undefined
              }
            >
              Remove TradingView access
            </SectionHeading>
            <p className="-mt-1.5 mb-3 text-sm text-muted-foreground">
              Their AutoPay stopped and the time they paid for has run out. Remove them on TradingView, then untick.
            </p>
          </div>
          <DataTable columns={removalColumns} rows={data.latest.needsRemoval} rowKey={(row) => row.customerKey} />
        </section>
      ) : null}

      {expiring.length > 0 ? (
        <section className="mt-8">
          <div className="px-4 sm:px-6">
            <SectionHeading
              action={
                dash && dash.access.expiring > expiring.length ? (
                  <SeeAll href={link("/indicator/customers", { status: "expiring" })} count={dash.access.expiring} />
                ) : undefined
              }
            >
              Expiring within 7 days
            </SectionHeading>
            <p className="-mt-1.5 mb-3 text-sm text-muted-foreground">
              Soonest first. AutoPay renews them on its own if it is still on; message anyone whose AutoPay has stopped.
            </p>
          </div>
          <DataTable columns={expiringColumns} rows={expiring} rowKey={(row) => row.customerKey} />
        </section>
      ) : null}

      <div className="mt-8 grid grid-cols-1 gap-6 px-4 sm:px-6 lg:grid-cols-2">
        <section>
          <SectionHeading action={<SeeAll href={link("/indicator/payments")} />}>Latest purchases</SectionHeading>
          {data.latest.payments.length === 0 ? (
            <EmptyState title="No purchases yet" description="Purchases appear here the moment Razorpay confirms them." />
          ) : (
            <ul className="glass divide-y divide-border/50 rounded-3xl">
              {data.latest.payments.map((payment) => (
                <PaymentLine key={payment.paymentId} payment={payment} />
              ))}
            </ul>
          )}
        </section>

        <section>
          <SectionHeading action={<SeeAll href={link("/indicator/failed")} />}>Latest failed payments</SectionHeading>
          {data.latest.failed.length === 0 ? (
            <EmptyState title="No failed payments" description="Declined attempts at checkout appear here." />
          ) : (
            <ul className="glass divide-y divide-border/50 rounded-3xl">
              {data.latest.failed.map((failure) => (
                <FailedLine key={failure.paymentId} failure={failure} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

type LinkFn = (path: string, params?: Record<string, string | undefined>) => string

/** Purchases by plan: a split bar and the figures behind it, each a link to those purchases. */
function PlanMix({ charts, dash, link }: { charts: ChartData; dash: Dashboard; link: LinkFn }) {
  const colour = (key: string) => (key === "3m" ? SERIES.gold : key === "1m" ? SERIES.blue : SERIES.neutral)
  const parts: Part[] = charts.plans.map((plan) => ({
    key: plan.key,
    label: plan.key === "1m" ? "1 Month plan" : plan.key === "3m" ? "3 Months plan" : plan.label,
    value: plan.count,
    color: colour(plan.key),
    detail: formatINRShort(plan.paise),
    hint: plan.count === 1 ? "1 purchase" : `${plan.count} purchases`,
    href: plan.key === "1m" || plan.key === "3m" ? link("/indicator/payments", { plan: plan.key }) : undefined,
  }))
  // A plan with no purchases yet still gets its row, so the split reads as the two plans on sale.
  for (const [key, label, color] of [
    ["1m", "1 Month plan", SERIES.blue],
    ["3m", "3 Months plan", SERIES.gold],
  ] as const) {
    if (!parts.some((p) => p.key === key)) {
      parts.push({ key, label, value: 0, color, detail: formatINRShort(0), hint: "No purchases yet", href: link("/indicator/payments", { plan: key }) })
    }
  }
  parts.sort((a, b) => (a.key === "1m" ? 0 : a.key === "3m" ? 1 : 2) - (b.key === "1m" ? 0 : b.key === "3m" ? 1 : 2))

  return (
    <ChartCard
      title="Plan mix"
      subtitle={`${plural(dash.sales.purchases, "purchase")} in all · ${formatINRShort(dash.sales.collectedPaise)} collected`}
    >
      <SegmentedBar parts={parts} unit="count" />
    </ChartCard>
  )
}

/** Which payment methods buyers use, most used first. */
function Methods({ charts }: { charts: ChartData }) {
  return (
    <ChartCard title="Payment methods" subtitle="How buyers paid, by number of purchases">
      <RankedBars
        items={charts.methods.map((m) => ({ key: m.key, label: m.label, value: m.count, detail: formatINRShort(m.paise) }))}
        unit="count"
        color={SERIES.teal}
        emptyText="No purchases yet."
      />
    </ChartCard>
  )
}

/** The renewal rate as a ring, with the two figures that go with it. */
function Renewals({ dash, link }: { dash: Dashboard; link: LinkFn }) {
  return (
    <ChartCard title="Renewals" subtitle="Customers who bought a second time, AutoPay renewals and new subscriptions alike">
      <div className="flex items-center gap-5">
        <RingMeter ratio={dash.renewals.renewalRate} label={`Renewal rate ${percent(dash.renewals.renewalRate)}`}>
          <span className="text-2xl font-bold tracking-tight text-foreground">{percent(dash.renewals.renewalRate)}</span>
          <span className="text-[0.625rem] font-semibold uppercase tracking-wider text-muted-foreground">renewal rate</span>
        </RingMeter>
        <dl className="min-w-0 flex-1 space-y-3">
          <div>
            <dt className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">Renewed at least once</dt>
            <dd className="mt-0.5 flex items-baseline gap-2">
              <Link href={link("/indicator/customers", { repeat: "yes" })} className="text-xl font-bold text-foreground transition-colors hover:text-primary">
                {dash.renewals.renewedCustomers}
              </Link>
              <span className="text-xs text-muted-foreground">of {plural(dash.access.customers, "customer")}</span>
            </dd>
          </div>
          <div>
            <dt className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">Average paid per customer</dt>
            <dd className="mt-0.5 flex items-baseline gap-2">
              <span className="text-xl font-bold text-foreground">{formatINRShort(dash.renewals.averagePaidPerCustomerPaise)}</span>
              <span className="text-xs text-muted-foreground">total collected ÷ customers</span>
            </dd>
          </div>
        </dl>
      </div>
    </ChartCard>
  )
}

/** Every customer as one bar: active, expiring soon, expired, needs a check. */
function AccessSplit({ dash, link }: { dash: Dashboard; link: LinkFn }) {
  const parts: Part[] = [
    { key: "active", label: "Active", value: dash.access.active, color: STATUS.active, href: link("/indicator/customers", { status: "active" }) },
    { key: "expiring", label: "Expiring soon", value: dash.access.expiring, color: STATUS.expiring, href: link("/indicator/customers", { status: "expiring" }) },
    { key: "expired", label: "Expired", value: dash.access.expired, color: STATUS.expired, href: link("/indicator/customers", { status: "expired" }) },
    { key: "check", label: "Check plan", value: dash.access.check, color: STATUS.check, href: link("/indicator/customers", { status: "check" }) },
  ]
  return (
    <div className="glass rounded-3xl p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">
          {plural(dash.access.customers, "customer")}, by access status
        </p>
        <p className="text-xs text-muted-foreground">Judged on today&apos;s date in India; 7 days or less left counts as expiring</p>
      </div>
      <SegmentedBar parts={parts} unit="count" list={false} thickness={14} />
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground" aria-label="Legend">
        {parts.map((part) => (
          <li key={part.key} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: part.color }} aria-hidden />
            {part.label} <span className="font-semibold tabular-nums text-foreground">{part.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Toggle({ row, canEdit }: { row: Customer; canEdit: boolean }) {
  return (
    <AccessToggle
      // Both lists here are already titled with what needs doing.
      hideAction
      subscriptionId={row.latestSubscriptionId}
      name={row.fullName}
      granted={row.access.granted}
      action={row.access.action}
      updatedBy={row.access.updatedBy}
      updatedLabel={row.access.updatedAt ? formatIST(row.access.updatedAt, "d MMM, h:mm a") : null}
      canEdit={canEdit}
    />
  )
}

function SeeAll({ href, count }: { href: string; count?: number }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
    >
      {count ? `See all ${count}` : "See all"}
      <ArrowRight className="size-3.5" aria-hidden />
    </Link>
  )
}

/** Two letters of a name, for the circle beside a list row. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

function PaymentLine({ payment }: { payment: Payment }) {
  const renewal = (payment.purchaseNumber ?? 1) > 1
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-xs font-semibold text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
        aria-hidden
      >
        {initials(payment.fullName)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{payment.fullName}</p>
        <p className="truncate text-xs text-muted-foreground">
          <span className="font-mono">{payment.tradingviewId}</span> · <When iso={payment.paidAt} pattern="d MMM, h:mm a" />
          {payment.plan ? ` · ${planLabel(payment.plan)}` : ""}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold tabular-nums text-paid-foreground">{formatINR(payment.amountPaise)}</p>
        <p className="text-[0.625rem] font-semibold uppercase tracking-wider text-muted-foreground">{renewal ? "Renewal" : "New"}</p>
      </div>
    </li>
  )
}

function FailedLine({ failure }: { failure: FailedPayment }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-xs font-semibold text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
        aria-hidden
      >
        {initials(failure.fullName)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{failure.fullName}</p>
        <p className="truncate text-xs text-muted-foreground">
          <When iso={failure.createdAt} pattern="d MMM, h:mm a" /> · {failure.errorDescription ?? "Payment failed"}
        </p>
      </div>
      <StatusPill tone={failure.recovered ? "paid" : "overdue"}>{failure.recovered ? "Paid later" : "Not paid"}</StatusPill>
    </li>
  )
}
