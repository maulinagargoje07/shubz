import Link from "next/link"
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CircleAlert,
  IndianRupee,
  Repeat,
  ShoppingBag,
  UserCheck,
  UserX,
  Users,
} from "lucide-react"

import { DataTable, type Column } from "@/components/data-table/table"
import { DeniedNotice } from "@/components/denied-notice"
import { AccessToggle } from "@/components/indicator/access-toggle"
import { BuyerCell, ContactCell, SubscriptionStatus, TradingViewCell, ValidTill, When } from "@/components/indicator/cells"
import { IndicatorToolbar } from "@/components/indicator/toolbar"
import { IndicatorUnavailable } from "@/components/indicator/unavailable"
import { PageHeader, SectionHeading } from "@/components/page-header"
import { EmptyState, StatTile, StatusPill } from "@/components/ui/status"
import { formatDate, formatIST, todayIST, toISTDateString } from "@/lib/fy"
import {
  planLabel,
  planName,
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
import { getOverview, PaymentsApiError } from "@/server/indicator/api"
import { fromRecord, hrefWith, modeParam } from "@/server/indicator/filters"

export const dynamic = "force-dynamic"
export const metadata = { title: "Dashboard" }

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const percent = (ratio: number) => `${(ratio * 100).toFixed(1)}%`

/**
 * The dashboard, laid out like the spreadsheet it replaced: access status
 * today, sales, renewals. Every figure comes from the payments service, which
 * works them out with one set of rules (see its README); nothing is computed
 * here. Below the figures: the to-do lists an admin acts on.
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
  try {
    data = await getOverview(requestedMode)
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

  const accessColumns: Column<Customer>[] = [
    {
      id: "buyer",
      header: "Customer",
      priority: "primary",
      cell: (row) => <BuyerCell name={row.fullName} email={row.email} />,
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
    accessColumns[4],
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
            className="flex items-start gap-2.5 rounded-xl border border-pending/30 bg-pending-muted px-4 py-3 text-sm text-pending-foreground"
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

      {dash ? (
        <>
          {/* ---------------------------------------------- Access status today */}
          <section className="px-4 pt-5 sm:px-6">
            <SectionHeading
              action={
                <span className="text-xs text-muted-foreground">
                  Today <span className="font-medium text-foreground">{formatDate(dash.today, "d MMM yyyy")}</span> (India)
                </span>
              }
            >
              Access status today
            </SectionHeading>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <StatTile
                label="Active subscribers"
                value={dash.access.active}
                tone={dash.access.active > 0 ? "paid" : undefined}
                icon={<Users className="size-3.5" />}
                hint="More than 7 days of access left"
                href={link("/indicator/customers", { status: "active" })}
              />
              <StatTile
                label="Expiring within 7 days"
                value={dash.access.expiring}
                icon={<CalendarClock className="size-3.5" />}
                hint={dash.access.expiring > 0 ? "Time to ask for a renewal" : "Nobody is about to run out"}
                href={link("/indicator/customers", { status: "expiring" })}
              />
              <StatTile
                label="Expired – access can be removed"
                value={dash.access.expired}
                tone={dash.access.expired > 0 ? "overdue" : undefined}
                icon={<UserX className="size-3.5" />}
                hint={dash.access.expired > 0 ? "Paid time has run out" : "Nobody has lapsed"}
                href={link("/indicator/customers", { status: "expired" })}
              />
              <StatTile
                label="Rows needing a check"
                value={dash.access.check}
                tone={dash.access.check > 0 ? "overdue" : undefined}
                icon={<CircleAlert className="size-3.5" />}
                hint={dash.access.check > 0 ? "Plan unknown, so no expiry" : "Every plan is known"}
                href={link("/indicator/customers", { status: "check" })}
              />
              <StatTile
                label="Total customers (merged)"
                value={dash.access.customers}
                icon={<Users className="size-3.5" />}
                hint={`One per TradingView username · ${plural(data.subscribers.total, "subscription")}`}
                href={link("/indicator/customers")}
              />
            </div>
          </section>

          {/* ------------------------------------------------------------ Sales */}
          <section className="px-4 pt-6 sm:px-6">
            <SectionHeading>Sales</SectionHeading>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile
                label="Total purchases"
                value={dash.sales.purchases}
                icon={<ShoppingBag className="size-3.5" />}
                hint="First payments and renewals"
                href={link("/indicator/payments")}
              />
              <StatTile
                label="1 Month plans sold"
                value={dash.sales.oneMonth}
                icon={<ShoppingBag className="size-3.5" />}
                href={link("/indicator/payments", { plan: "1m" })}
              />
              <StatTile
                label="3 Month plans sold"
                value={dash.sales.threeMonths}
                icon={<ShoppingBag className="size-3.5" />}
                hint={dash.sales.otherPlans > 0 ? `${plural(dash.sales.otherPlans, "purchase")} on another plan` : undefined}
                href={link("/indicator/payments", { plan: "3m" })}
              />
              <StatTile
                label="Total collected"
                value={formatINRShort(dash.sales.collectedPaise)}
                icon={<IndianRupee className="size-3.5" />}
                href={link("/indicator/payments")}
              />
              <StatTile
                label="Net earned (after fees)"
                value={formatINRShort(dash.sales.netEarnedPaise)}
                icon={<IndianRupee className="size-3.5" />}
                hint={
                  dash.sales.feeKnownFor < dash.sales.purchases
                    ? `Razorpay's fee known for ${dash.sales.feeKnownFor} of ${dash.sales.purchases}; the rest counted in full`
                    : "After Razorpay's fees"
                }
                href={link("/indicator/payments")}
              />
              <StatTile
                label={`Purchases in ${monthName}`}
                value={dash.sales.thisMonth.purchases}
                icon={<ShoppingBag className="size-3.5" />}
                href={link("/indicator/payments", { from: monthFrom, to: todayIST() })}
              />
              <StatTile
                label={`Collected in ${monthName}`}
                value={formatINRShort(dash.sales.thisMonth.collectedPaise)}
                icon={<IndianRupee className="size-3.5" />}
                href={link("/indicator/payments", { from: monthFrom, to: todayIST() })}
              />
            </div>
          </section>

          {/* --------------------------------------------------------- Renewals */}
          <section className="px-4 pt-6 sm:px-6">
            <SectionHeading>Renewals</SectionHeading>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatTile
                label="Customers who renewed at least once"
                value={dash.renewals.renewedCustomers}
                icon={<Repeat className="size-3.5" />}
                hint="AutoPay renewals and new subscriptions alike"
                href={link("/indicator/customers", { repeat: "yes" })}
              />
              <StatTile
                label="Renewal rate"
                value={percent(dash.renewals.renewalRate)}
                icon={<Repeat className="size-3.5" />}
                hint={`${dash.renewals.renewedCustomers} of ${plural(dash.access.customers, "customer")}`}
              />
              <StatTile
                label="Average paid per customer"
                value={formatINRShort(dash.renewals.averagePaidPerCustomerPaise)}
                icon={<IndianRupee className="size-3.5" />}
                hint="Total collected ÷ customers"
              />
            </div>
          </section>
        </>
      ) : (
        <div className="px-4 pt-4 sm:px-6">
          <p className="flex items-start gap-2.5 rounded-xl border border-pending/30 bg-pending-muted px-4 py-3 text-sm text-pending-foreground">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>The payments service needs updating before the dashboard figures can show here.</span>
          </p>
        </div>
      )}

      {/* ------------------------------------------------------------- To do */}
      <section className="px-4 pt-6 sm:px-6">
        <SectionHeading>To do</SectionHeading>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile
            label="Give TradingView access"
            value={data.access.needsAccess}
            tone={data.access.needsAccess > 0 ? "overdue" : undefined}
            icon={<UserCheck className="size-3.5" />}
            hint={data.access.needsAccess > 0 ? "Paid, waiting for access" : "Everyone who paid has access"}
            href={link("/indicator/customers", { access: "grant" })}
          />
          <StatTile
            label="Remove TradingView access"
            value={data.access.needsRemoval}
            tone={data.access.needsRemoval > 0 ? "overdue" : undefined}
            icon={<UserX className="size-3.5" />}
            hint={data.access.needsRemoval > 0 ? "Stopped paying, still ticked" : "Nothing to remove"}
            href={link("/indicator/customers", { access: "remove" })}
          />
          <StatTile
            label="Failed payments to follow up"
            value={data.failed.unrecovered}
            icon={<CircleAlert className="size-3.5" />}
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
            <ul className="divide-y divide-border/60 rounded-xl border border-border/80 bg-card">
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
            <ul className="divide-y divide-border/60 rounded-xl border border-border/80 bg-card">
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

function PaymentLine({ payment }: { payment: Payment }) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{payment.fullName}</p>
        <p className="truncate text-xs text-muted-foreground">
          <span className="font-mono">{payment.tradingviewId}</span> · <When iso={payment.paidAt} pattern="d MMM, h:mm a" />
          {payment.plan ? ` · ${planLabel(payment.plan)}` : ""}
          {payment.purchaseNumber && payment.purchaseNumber > 1 ? ` · renewal` : ""}
        </p>
      </div>
      <p className="shrink-0 text-sm font-semibold tabular-nums text-paid-foreground">{formatINR(payment.amountPaise)}</p>
    </li>
  )
}

function FailedLine({ failure }: { failure: FailedPayment }) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{failure.fullName}</p>
        <p className="truncate text-xs text-muted-foreground">
          <When iso={failure.createdAt} pattern="d MMM, h:mm a" /> · {failure.errorDescription ?? "Payment failed"}
        </p>
      </div>
      <StatusPill tone={failure.recovered ? "paid" : "overdue"}>{failure.recovered ? "Paid later" : "Not paid"}</StatusPill>
    </li>
  )
}
