import Link from "next/link"
import { ArrowRight, BadgeCheck, CircleAlert, IndianRupee, UserCheck, UserX, Users } from "lucide-react"

import { DataTable, type Column } from "@/components/data-table/table"
import { DeniedNotice } from "@/components/denied-notice"
import { AccessToggle } from "@/components/indicator/access-toggle"
import { BuyerCell, ContactCell, SubscriptionStatus, TradingViewCell, When } from "@/components/indicator/cells"
import { IndicatorToolbar } from "@/components/indicator/toolbar"
import { IndicatorUnavailable } from "@/components/indicator/unavailable"
import { PageHeader, SectionHeading } from "@/components/page-header"
import { EmptyState, StatTile, StatusPill } from "@/components/ui/status"
import { formatIST, todayIST, toISTDateString } from "@/lib/fy"
import type { FailedPayment, IndicatorOverview, Payment, Subscriber } from "@/lib/indicator"
import { formatINR, formatINRShort } from "@/lib/money"
import { can } from "@/lib/permissions"
import type { RawParam } from "@/lib/search-params"
import { requirePermissionPage } from "@/lib/session"
import { getOverview, PaymentsApiError } from "@/server/indicator/api"
import { fromRecord, hrefWith, modeParam } from "@/server/indicator/filters"

export const dynamic = "force-dynamic"
export const metadata = { title: "Indicator" }

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

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
        <PageHeader title="Indicator" description="7 Godfather Strategies subscribers and payments." />
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
  const plan = data.plan

  const accessColumns: Column<Subscriber>[] = [
    {
      id: "buyer",
      header: "Buyer",
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
      cell: (row) => <When iso={row.lastPaymentAt ?? row.createdAt} pattern="d MMM, h:mm a" />,
    },
    {
      id: "actions",
      header: "TradingView access",
      align: "right",
      cell: (row) => <Toggle row={row} canEdit={canTick} />,
    },
  ]

  const removalColumns: Column<Subscriber>[] = [
    accessColumns[0],
    accessColumns[1],
    {
      id: "status",
      header: "Status",
      priority: "secondary",
      cell: (row) => (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <SubscriptionStatus status={row.status} />
          {row.paidThrough ? (
            <span className="text-xs text-muted-foreground">paid until {formatIST(row.paidThrough, "d MMM")}</span>
          ) : null}
        </span>
      ),
    },
    accessColumns[4],
  ]

  return (
    <div className="pb-8">
      <PageHeader
        title="Indicator"
        description={
          plan
            ? `${plan.name} · ${formatINRShort(plan.amountPaise)} a month by AutoPay`
            : "7 Godfather Strategies subscribers and payments."
        }
      />
      <DeniedNotice show={raw.denied === "1"} />
      <IndicatorToolbar path="/indicator" mode={data.mode} serviceMode={data.serviceMode} generatedAt={data.generatedAt} />

      <div className="grid grid-cols-1 gap-3 px-4 py-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
        <StatTile
          label="Active subscribers"
          value={data.subscribers.current}
          icon={<Users className="size-3.5" />}
          hint={
            data.subscribers.pending > 0
              ? `${plural(data.subscribers.pending, "renewal")} being retried`
              : `${data.subscribers.newThisMonth} new in ${monthName}`
          }
          href={link("/indicator/subscribers", { status: "current" })}
        />
        <StatTile
          label={`Collected in ${monthName}`}
          value={formatINRShort(data.revenue.monthPaise)}
          icon={<IndianRupee className="size-3.5" />}
          hint={plural(data.revenue.monthCount, "payment")}
          href={link("/indicator/payments", { from: monthFrom, to: todayIST() })}
        />
        <StatTile
          label="Collected in total"
          value={formatINRShort(data.revenue.totalPaise)}
          icon={<IndianRupee className="size-3.5" />}
          hint={`${plural(data.revenue.totalCount, "payment")} from ${plural(data.subscribers.total, "subscriber")}`}
          href={link("/indicator/payments")}
        />
        <StatTile
          label="Give TradingView access"
          value={data.access.needsAccess}
          tone={data.access.needsAccess > 0 ? "overdue" : undefined}
          icon={<UserCheck className="size-3.5" />}
          hint={data.access.needsAccess > 0 ? "Paid, waiting for access" : "Everyone who paid has access"}
          href={link("/indicator/subscribers", { access: "grant" })}
        />
        <StatTile
          label="Remove TradingView access"
          value={data.access.needsRemoval}
          tone={data.access.needsRemoval > 0 ? "overdue" : undefined}
          icon={<UserX className="size-3.5" />}
          hint={data.access.needsRemoval > 0 ? "Stopped paying, still ticked" : "Nothing to remove"}
          href={link("/indicator/subscribers", { access: "remove" })}
        />
        <StatTile
          label="Failed payments to follow up"
          value={data.failed.unrecovered}
          icon={<CircleAlert className="size-3.5" />}
          hint={`${plural(data.failed.last7Days, "failure")} in the last 7 days`}
          href={link("/indicator/failed", { recovered: "no" })}
        />
      </div>

      <section className="mt-2">
        <div className="px-4 sm:px-6">
          <SectionHeading
            action={
              data.access.needsAccess > data.latest.needsAccess.length ? (
                <SeeAll href={link("/indicator/subscribers", { access: "grant" })} count={data.access.needsAccess} />
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
          <DataTable columns={accessColumns} rows={data.latest.needsAccess} rowKey={(row) => row.subscriptionId} />
        )}
      </section>

      {data.latest.needsRemoval.length > 0 ? (
        <section className="mt-8">
          <div className="px-4 sm:px-6">
            <SectionHeading
              action={
                data.access.needsRemoval > data.latest.needsRemoval.length ? (
                  <SeeAll href={link("/indicator/subscribers", { access: "remove" })} count={data.access.needsRemoval} />
                ) : undefined
              }
            >
              Remove TradingView access
            </SectionHeading>
            <p className="-mt-1.5 mb-3 text-sm text-muted-foreground">
              Their AutoPay stopped and the time they paid for has run out. Remove them on TradingView, then untick.
            </p>
          </div>
          <DataTable columns={removalColumns} rows={data.latest.needsRemoval} rowKey={(row) => row.subscriptionId} />
        </section>
      ) : null}

      <div className="mt-8 grid grid-cols-1 gap-6 px-4 sm:px-6 lg:grid-cols-2">
        <section>
          <SectionHeading action={<SeeAll href={link("/indicator/payments")} />}>Latest payments</SectionHeading>
          {data.latest.payments.length === 0 ? (
            <EmptyState title="No payments yet" description="Payments appear here the moment Razorpay confirms them." />
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

function Toggle({ row, canEdit }: { row: Subscriber; canEdit: boolean }) {
  return (
    <AccessToggle
      // Both lists here are already titled with what needs doing.
      hideAction
      subscriptionId={row.subscriptionId}
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
