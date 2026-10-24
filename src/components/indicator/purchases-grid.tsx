"use client"

/**
 * The sheet's Purchases tab as a grid: every successful payment with the
 * export's columns and the calculated ones (purchase date, plan, months,
 * expiry, days left, status, repurchased, times repurchased, purchase #),
 * each row coloured by its own status.
 */

import { Grid, type GridColumn } from "@/components/grid/grid"
import { AccessStatus, RazorpayId, SubscriptionStatus, TradingViewCell } from "@/components/indicator/cells"
import {
  expiryStatusLabel,
  paymentMethodLabel,
  planLabel,
  subscriptionStatusLabel,
  type Payment,
} from "@/lib/indicator"
import { todayIST } from "@/lib/fy"
import { formatPhone } from "@/lib/phone-format"

export function PurchasesGrid({
  rows,
  initialFilters,
  initialSearch,
}: {
  rows: Payment[]
  initialFilters?: Record<string, string[] | undefined>
  initialSearch?: string
}) {
  const columns: GridColumn<Payment>[] = [
    { id: "name", header: "Full name", pinned: true, value: (r) => r.fullName, cell: (r) => <span className="font-medium">{r.fullName}</span> },
    {
      id: "paymentId",
      header: "Payment ID",
      value: (r) => r.paymentId,
      cell: (r) => <RazorpayId id={r.paymentId} label="payment ID" />,
    },
    { id: "paid", header: "Paid", kind: "money", align: "right", sum: true, value: (r) => r.amountPaise },
    {
      id: "earned",
      header: "Earned (after fees)",
      kind: "money",
      align: "right",
      sum: true,
      // The service already puts the full amount here while Razorpay's fee is unknown.
      value: (r) => r.netPaise ?? r.amountPaise,
    },
    { id: "paidAt", header: "Date", kind: "datetime", value: (r) => r.paidAt },
    { id: "email", header: "Email", value: (r) => r.email },
    {
      id: "phone",
      header: "Phone",
      // Written with spaces ("+91 98765 00004"), which Excel keeps as text.
      value: (r) => (r.contactNumber ? formatPhone(r.contactNumber) : null),
      cell: (r) => (r.contactNumber ? <span className="tabular-nums">{formatPhone(r.contactNumber)}</span> : <span className="text-muted-foreground">—</span>),
    },
    {
      id: "tradingview",
      header: "TradingView username",
      value: (r) => r.tradingviewId,
      cell: (r) => (r.tradingviewId ? <TradingViewCell id={r.tradingviewId} /> : <span className="text-muted-foreground">—</span>),
    },
    { id: "purchaseDate", header: "Purchase date", kind: "date", value: (r) => r.purchaseDate },
    { id: "plan", header: "Plan", value: (r) => (r.plan ? planLabel(r.plan) : null) },
    { id: "months", header: "Months", kind: "number", align: "right", value: (r) => r.plan?.months ?? null },
    { id: "expiry", header: "Expiry date", kind: "date", value: (r) => r.expiryDate },
    { id: "daysLeft", header: "Days left", kind: "number", align: "right", value: (r) => r.daysLeft },
    {
      id: "status",
      header: "Access status",
      value: (r) => expiryStatusLabel(r.accessStatus),
      cell: (r) => <AccessStatus status={r.accessStatus} />,
    },
    { id: "repurchased", header: "Repurchased", kind: "yesno", value: (r) => r.repurchased ?? false },
    { id: "timesRepurchased", header: "Times repurchased", kind: "number", align: "right", value: (r) => r.timesRepurchased },
    { id: "purchaseNumber", header: "This purchase # (1 = first)", kind: "number", align: "right", value: (r) => r.purchaseNumber },
    { id: "method", header: "Method", value: (r) => paymentMethodLabel(r.method) },
    { id: "paymentStatus", header: "Payment status", value: (r) => r.status },
    {
      id: "autopay",
      header: "AutoPay",
      value: (r) => (r.subscriptionStatus ? subscriptionStatusLabel(r.subscriptionStatus) : null),
      cell: (r) => (r.subscriptionStatus ? <SubscriptionStatus status={r.subscriptionStatus} /> : <span className="text-muted-foreground">—</span>),
    },
    {
      id: "subscriptionId",
      header: "Subscription ID",
      value: (r) => r.subscriptionId,
      cell: (r) => <RazorpayId id={r.subscriptionId} label="subscription ID" />,
    },
  ]

  return (
    <Grid
      columns={columns}
      rows={rows}
      rowKey={(r) => r.paymentId}
      rowTone={(r) => r.accessStatus}
      noun="purchases"
      downloadName={`shubztrader-purchases-${todayIST()}`}
      initialSort={{ id: "paidAt", dir: "desc" }}
      initialFilters={initialFilters}
      initialSearch={initialSearch}
      emptyMessage="Purchases appear here the moment Razorpay confirms them."
    />
  )
}
