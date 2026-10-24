"use client"

/**
 * The sheet's Customers tab as a grid: one row per person, the sheet's
 * columns in the sheet's order, the row coloured by status, with the CRM's
 * own AutoPay and access-tick columns pulled up next to the name.
 */

import { MessageCircle } from "lucide-react"

import { Grid, type GridColumn } from "@/components/grid/grid"
import { AccessToggle } from "@/components/indicator/access-toggle"
import { AccessStatus, SubscriptionStatus, TradingViewCell } from "@/components/indicator/cells"
import { formatIST, todayIST } from "@/lib/fy"
import { expiryStatusLabel, planLabel, subscriptionStatusLabel, type Customer } from "@/lib/indicator"
import { formatPhone, whatsappHref } from "@/lib/phone-format"

export function CustomersGrid({
  rows,
  canTick,
  initialFilters,
  initialSearch,
}: {
  rows: Customer[]
  canTick: boolean
  initialFilters?: Record<string, string[] | undefined>
  initialSearch?: string
}) {
  const columns: GridColumn<Customer>[] = [
    { id: "name", header: "Name", pinned: true, value: (r) => r.fullName, cell: (r) => <span className="font-medium">{r.fullName}</span> },
    {
      id: "tradingview",
      header: "TradingView username",
      value: (r) => r.tradingviewId,
      cell: (r) => (r.tradingviewId ? <TradingViewCell id={r.tradingviewId} /> : <span className="text-muted-foreground">—</span>),
    },
    // AutoPay and the tick sit up front, so whether access is given is seen without scrolling.
    {
      id: "autopay",
      header: "AutoPay",
      value: (r) => subscriptionStatusLabel(r.subscriptionStatus),
      cell: (r) => (
        <span className="inline-flex items-center gap-1">
          <SubscriptionStatus status={r.subscriptionStatus} />
          {r.subscriptionCount > 1 ? <span className="text-xs text-muted-foreground">×{r.subscriptionCount}</span> : null}
        </span>
      ),
    },
    {
      id: "accessGiven",
      header: "Access given",
      kind: "yesno",
      value: (r) => r.access.granted,
      cell: (r) => (
        <AccessToggle
          subscriptionId={r.latestSubscriptionId}
          name={r.fullName}
          granted={r.access.granted}
          action={r.access.action}
          updatedBy={r.access.updatedBy}
          updatedLabel={r.access.updatedAt ? formatIST(r.access.updatedAt, "d MMM, h:mm a") : null}
          canEdit={canTick}
          hideAction
          compact
        />
      ),
    },
    { id: "email", header: "Email", value: (r) => r.email },
    {
      id: "phone",
      header: "Phone",
      // Written with spaces ("+91 98765 00004"), which Excel keeps as text.
      value: (r) => (r.contactNumber ? formatPhone(r.contactNumber) : null),
      cell: (r) =>
        r.contactNumber ? (
          <a href={`tel:${r.contactNumber}`} className="tabular-nums underline-offset-4 hover:text-primary hover:underline">
            {formatPhone(r.contactNumber)}
          </a>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "whatsapp",
      header: "WhatsApp",
      plain: true,
      value: () => null,
      cell: (r) =>
        r.contactNumber ? (
          <a
            href={whatsappHref(r.contactNumber)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-paid-foreground underline-offset-4 hover:underline"
          >
            <MessageCircle className="size-3.5" aria-hidden />
            Message
          </a>
        ) : null,
    },
    { id: "purchases", header: "Purchases", kind: "number", align: "right", value: (r) => r.purchaseCount },
    { id: "repurchased", header: "Repurchased", kind: "yesno", value: (r) => r.purchaseCount > 1 },
    { id: "latestPlan", header: "Latest plan", value: (r) => (r.latestPlan ? planLabel(r.latestPlan) : null) },
    { id: "firstPurchase", header: "First purchase", kind: "date", value: (r) => r.firstPurchase },
    { id: "latestPurchase", header: "Latest purchase", kind: "date", value: (r) => r.latestPurchase },
    { id: "validTill", header: "Access valid till", kind: "date", value: (r) => r.validTill },
    { id: "daysLeft", header: "Days left", kind: "number", align: "right", value: (r) => r.daysLeft },
    {
      id: "status",
      header: "Status",
      value: (r) => expiryStatusLabel(r.accessStatus),
      cell: (r) => <AccessStatus status={r.accessStatus} />,
    },
    { id: "totalPaid", header: "Total paid", kind: "money", align: "right", sum: true, value: (r) => r.totalPaidPaise },
    {
      id: "todo",
      header: "To do",
      value: (r) => (r.access.action === "grant" ? "Needs access" : r.access.action === "remove" ? "Needs removal" : null),
    },
  ]

  return (
    <Grid
      columns={columns}
      rows={rows}
      rowKey={(r) => r.customerKey}
      rowTone={(r) => r.accessStatus}
      noun="customers"
      downloadName={`shubztrader-customers-${todayIST()}`}
      initialSort={{ id: "latestPurchase", dir: "desc" }}
      initialFilters={initialFilters}
      initialSearch={initialSearch}
      emptyMessage="Buyers appear here the moment their first AutoPay payment goes through."
    />
  )
}
