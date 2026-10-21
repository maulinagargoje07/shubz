/**
 * The Excel and CSV downloads: which columns each list exports, and the file.
 *
 * One column list per dataset feeds both formats, so the two files can't
 * disagree. Each column says how its value is typed in Excel; the CSV gets
 * plain text versions of the same values (India time, rupees with paise).
 */

import { toCsv, type CsvValue } from "@/lib/export/csv"
import { buildXlsx, XLSX_CONTENT_TYPE, type XlsxColumnType, type XlsxValue } from "@/lib/export/xlsx"
import { formatIST, todayIST } from "@/lib/fy"
import {
  expiryStatusLabel,
  paymentMethodLabel,
  planLabel,
  subscriptionStatusLabel,
  type Customer,
  type FailedPayment,
  type IndicatorMode,
  type Payment,
  type Subscriber,
} from "@/lib/indicator"
import { formatPhone, whatsappHref } from "@/lib/phone-format"
import type { PaymentsApiError } from "@/server/indicator/api"

export type ExportFormat = "xlsx" | "csv"

type Column<Row> = {
  header: string
  width: number
  type?: XlsxColumnType
  value: (row: Row) => XlsxValue
  /** When the CSV should carry something other than `value`. */
  csv?: (row: Row) => CsvValue
}

const yesNo = (value: boolean | null | undefined) => (value ? "Yes" : "No")
const todo = (action: "grant" | "remove" | null) =>
  action === "grant" ? "Give access" : action === "remove" ? "Remove access" : ""

const contactColumn = <Row extends { contactNumber: string }>(): Column<Row> => ({
  header: "Contact number",
  width: 18,
  // Readable in Excel; the CSV keeps "+919876543210" for messaging tools.
  value: (r) => formatPhone(r.contactNumber),
  csv: (r) => r.contactNumber,
})

const SUBSCRIBER_COLUMNS: Column<Subscriber>[] = [
  { header: "Name", width: 24, value: (r) => r.fullName },
  { header: "Email", width: 30, value: (r) => r.email },
  contactColumn<Subscriber>(),
  { header: "TradingView username", width: 22, value: (r) => r.tradingviewId },
  { header: "Status", width: 16, value: (r) => subscriptionStatusLabel(r.status) },
  { header: "Plan", width: 12, value: (r) => planLabel(r.plan) },
  { header: "Plan price (₹)", width: 13, type: "money", value: (r) => r.plan?.amountPaise ?? null },
  { header: "TradingView access given", width: 14, value: (r) => yesNo(r.access.granted) },
  { header: "To do on TradingView", width: 18, value: (r) => todo(r.access.action) },
  { header: "Access ticked by", width: 18, value: (r) => r.access.updatedBy },
  { header: "Access ticked at", width: 18, type: "datetime", value: (r) => r.access.updatedAt },
  { header: "Payments", width: 10, type: "integer", value: (r) => r.paymentCount },
  { header: "Total paid (₹)", width: 14, type: "money", value: (r) => r.totalPaidPaise },
  { header: "Paid until", width: 14, type: "date", value: (r) => r.paidThrough },
  { header: "Days left", width: 10, type: "integer", value: (r) => r.daysLeft ?? null },
  { header: "Access status", width: 14, value: (r) => expiryStatusLabel(r.accessStatus) },
  { header: "Last payment", width: 18, type: "datetime", value: (r) => r.lastPaymentAt },
  { header: "Joined", width: 18, type: "datetime", value: (r) => r.createdAt },
  { header: "Razorpay subscription ID", width: 24, value: (r) => r.subscriptionId },
  { header: "Razorpay customer ID", width: 22, value: (r) => r.customerId },
  { header: "Mode", width: 8, value: (r) => r.mode },
]

// The sheet's Purchases tab: the export columns, then the calculated ones.
const PAYMENT_COLUMNS: Column<Payment>[] = [
  { header: "Paid at", width: 18, type: "datetime", value: (r) => r.paidAt },
  { header: "Purchase date", width: 14, type: "date", value: (r) => r.purchaseDate ?? null },
  { header: "Name", width: 24, value: (r) => r.fullName },
  { header: "Email", width: 30, value: (r) => r.email },
  contactColumn<Payment>(),
  { header: "TradingView username", width: 22, value: (r) => r.tradingviewId },
  { header: "Amount (₹)", width: 12, type: "money", value: (r) => r.amountPaise },
  { header: "Razorpay fee (₹)", width: 14, type: "money", value: (r) => r.feePaise ?? null },
  { header: "Net after fee (₹)", width: 15, type: "money", value: (r) => r.netPaise ?? r.amountPaise },
  { header: "Currency", width: 9, value: (r) => r.currency },
  { header: "Plan", width: 12, value: (r) => planLabel(r.plan) },
  { header: "Months", width: 8, type: "integer", value: (r) => r.plan?.months ?? null },
  { header: "Expiry date", width: 14, type: "date", value: (r) => r.expiryDate ?? null },
  { header: "Days left", width: 10, type: "integer", value: (r) => r.daysLeft ?? null },
  { header: "Access status", width: 14, value: (r) => expiryStatusLabel(r.accessStatus) },
  { header: "Repurchased", width: 12, value: (r) => yesNo(r.repurchased) },
  { header: "Times repurchased", width: 16, type: "integer", value: (r) => r.timesRepurchased ?? null },
  { header: "This purchase # (1 = first)", width: 22, type: "integer", value: (r) => r.purchaseNumber ?? null },
  { header: "Method", width: 12, value: (r) => paymentMethodLabel(r.method) },
  { header: "Payment status", width: 14, value: (r) => r.status },
  { header: "AutoPay status", width: 16, value: (r) => (r.subscriptionStatus ? subscriptionStatusLabel(r.subscriptionStatus) : "") },
  { header: "Razorpay payment ID", width: 22, value: (r) => r.paymentId },
  { header: "Razorpay subscription ID", width: 24, value: (r) => r.subscriptionId },
  { header: "Razorpay invoice ID", width: 22, value: (r) => r.invoiceId },
  { header: "Customer key", width: 22, value: (r) => r.customerKey ?? "" },
  { header: "Mode", width: 8, value: (r) => r.mode },
]

// The sheet's Customers tab: one row per person.
const CUSTOMER_COLUMNS: Column<Customer>[] = [
  { header: "Name", width: 24, value: (r) => r.fullName },
  { header: "TradingView username", width: 22, value: (r) => r.tradingviewId },
  { header: "Email", width: 30, value: (r) => r.email },
  contactColumn<Customer>(),
  { header: "WhatsApp", width: 30, value: (r) => whatsappHref(r.contactNumber) },
  { header: "Purchases", width: 10, type: "integer", value: (r) => r.purchaseCount },
  { header: "Latest plan", width: 12, value: (r) => planLabel(r.latestPlan) },
  { header: "First purchase", width: 14, type: "date", value: (r) => r.firstPurchase },
  { header: "Latest purchase", width: 14, type: "date", value: (r) => r.latestPurchase },
  { header: "Access valid till", width: 16, type: "date", value: (r) => r.validTill },
  { header: "Days left", width: 10, type: "integer", value: (r) => r.daysLeft },
  { header: "Status", width: 14, value: (r) => expiryStatusLabel(r.accessStatus) },
  { header: "Total paid (₹)", width: 14, type: "money", value: (r) => r.totalPaidPaise },
  { header: "Net after fees (₹)", width: 16, type: "money", value: (r) => r.netPaidPaise },
  { header: "Repurchased", width: 12, value: (r) => yesNo(r.repurchased) },
  { header: "Times repurchased", width: 16, type: "integer", value: (r) => r.timesRepurchased },
  { header: "AutoPay status", width: 16, value: (r) => subscriptionStatusLabel(r.subscriptionStatus) },
  { header: "TradingView access given", width: 14, value: (r) => yesNo(r.access.granted) },
  { header: "To do on TradingView", width: 18, value: (r) => todo(r.access.action) },
  { header: "Access ticked by", width: 18, value: (r) => r.access.updatedBy },
  { header: "Access ticked at", width: 18, type: "datetime", value: (r) => r.access.updatedAt },
  { header: "Subscriptions", width: 12, type: "integer", value: (r) => r.subscriptionCount },
  { header: "Latest Razorpay subscription ID", width: 28, value: (r) => r.latestSubscriptionId },
  { header: "Customer key", width: 22, value: (r) => r.customerKey },
  { header: "Mode", width: 8, value: (r) => r.mode },
]

const FAILED_COLUMNS: Column<FailedPayment>[] = [
  { header: "Attempted at", width: 18, type: "datetime", value: (r) => r.createdAt },
  { header: "Name", width: 24, value: (r) => r.fullName },
  { header: "Email", width: 30, value: (r) => r.email },
  contactColumn<FailedPayment>(),
  { header: "TradingView username", width: 22, value: (r) => r.tradingviewId },
  { header: "Amount (₹)", width: 12, type: "money", value: (r) => r.amountPaise },
  { header: "Method", width: 12, value: (r) => paymentMethodLabel(r.method) },
  { header: "Reason", width: 36, value: (r) => r.errorDescription },
  { header: "Error code", width: 20, value: (r) => r.errorCode },
  { header: "Error source", width: 14, value: (r) => r.errorSource },
  { header: "Error step", width: 22, value: (r) => r.errorStep },
  { header: "Error reason", width: 22, value: (r) => r.errorReason },
  { header: "Paid later", width: 10, value: (r) => yesNo(r.recovered) },
  { header: "Paid later at", width: 18, type: "datetime", value: (r) => r.recoveredAt },
  { header: "Razorpay payment ID", width: 22, value: (r) => r.paymentId },
  { header: "Razorpay subscription ID", width: 24, value: (r) => r.subscriptionId },
  { header: "Mode", width: 8, value: (r) => r.mode },
]

/** The CSV form of a typed value: what a person would type into a sheet. */
function csvValue<Row>(column: Column<Row>, row: Row): CsvValue {
  if (column.csv) return column.csv(row)
  const value = column.value(row)
  if (value === null || value === undefined) return ""
  switch (column.type) {
    case "money":
      return typeof value === "number" ? (value / 100).toFixed(2) : value
    case "datetime":
      return typeof value === "string" ? formatIST(value, "yyyy-MM-dd HH:mm") : value
    case "date":
      return typeof value === "string" ? formatIST(value, "yyyy-MM-dd") : value
    default:
      return value
  }
}

function fileResponse<Row>(
  name: string,
  sheet: string,
  columns: Column<Row>[],
  rows: Row[],
  mode: IndicatorMode,
  format: ExportFormat
): Response {
  // Test purchases are labelled in the file name so they can't be mistaken for real ones.
  const base = `shubztrader-${name}${mode === "test" ? "-test" : ""}-${todayIST()}`
  const headers = {
    "Cache-Control": "no-store, private",
    "X-Content-Type-Options": "nosniff",
  }

  if (format === "csv") {
    const csv = toCsv(
      columns.map((c) => c.header),
      rows.map((row) => columns.map((c) => csvValue(c, row)))
    )
    return new Response(csv, {
      headers: {
        ...headers,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${base}.csv"`,
      },
    })
  }

  const file = buildXlsx(
    mode === "test" ? `${sheet} (test)` : sheet,
    columns.map((c) => ({ header: c.header, width: c.width, type: c.type })),
    rows.map((row) => columns.map((c) => c.value(row)))
  )
  return new Response(new Uint8Array(file), {
    headers: {
      ...headers,
      "Content-Type": XLSX_CONTENT_TYPE,
      "Content-Disposition": `attachment; filename="${base}.xlsx"`,
    },
  })
}

export const exportSubscribers = (rows: Subscriber[], mode: IndicatorMode, format: ExportFormat) =>
  fileResponse("subscribers", "Subscribers", SUBSCRIBER_COLUMNS, rows, mode, format)

export const exportPayments = (rows: Payment[], mode: IndicatorMode, format: ExportFormat) =>
  fileResponse("purchases", "Purchases", PAYMENT_COLUMNS, rows, mode, format)

export const exportCustomers = (rows: Customer[], mode: IndicatorMode, format: ExportFormat) =>
  fileResponse("customers", "Customers", CUSTOMER_COLUMNS, rows, mode, format)

export const exportFailedPayments = (rows: FailedPayment[], mode: IndicatorMode, format: ExportFormat) =>
  fileResponse("failed-payments", "Failed payments", FAILED_COLUMNS, rows, mode, format)

export function exportFormat(value: string | null): ExportFormat {
  return value === "csv" ? "csv" : "xlsx"
}

/** Shown in the browser tab when a download couldn't be made. */
export function exportFailure(error: PaymentsApiError): Response {
  return new Response(`Couldn't make the download: ${error.message}`, {
    status: error.kind === "bad_request" ? 400 : 502,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  })
}
