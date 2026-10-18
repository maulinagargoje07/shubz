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
  paymentMethodLabel,
  subscriptionStatusLabel,
  type FailedPayment,
  type IndicatorMode,
  type Payment,
  type Subscriber,
} from "@/lib/indicator"
import { formatPhone } from "@/lib/phone-format"
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

const yesNo = (value: boolean) => (value ? "Yes" : "No")

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
  { header: "TradingView access given", width: 14, value: (r) => yesNo(r.access.granted) },
  {
    header: "To do on TradingView",
    width: 18,
    value: (r) => (r.access.action === "grant" ? "Give access" : r.access.action === "remove" ? "Remove access" : ""),
  },
  { header: "Access ticked by", width: 18, value: (r) => r.access.updatedBy },
  { header: "Access ticked at", width: 18, type: "datetime", value: (r) => r.access.updatedAt },
  { header: "Payments", width: 10, type: "integer", value: (r) => r.paymentCount },
  { header: "Total paid (₹)", width: 14, type: "money", value: (r) => r.totalPaidPaise },
  { header: "Paid until", width: 14, type: "date", value: (r) => r.paidThrough },
  { header: "Last payment", width: 18, type: "datetime", value: (r) => r.lastPaymentAt },
  { header: "Joined", width: 18, type: "datetime", value: (r) => r.createdAt },
  { header: "Razorpay subscription ID", width: 24, value: (r) => r.subscriptionId },
  { header: "Razorpay customer ID", width: 22, value: (r) => r.customerId },
  { header: "Mode", width: 8, value: (r) => r.mode },
]

const PAYMENT_COLUMNS: Column<Payment>[] = [
  { header: "Paid at", width: 18, type: "datetime", value: (r) => r.paidAt },
  { header: "Name", width: 24, value: (r) => r.fullName },
  { header: "Email", width: 30, value: (r) => r.email },
  contactColumn<Payment>(),
  { header: "TradingView username", width: 22, value: (r) => r.tradingviewId },
  { header: "Amount (₹)", width: 12, type: "money", value: (r) => r.amountPaise },
  { header: "Currency", width: 9, value: (r) => r.currency },
  { header: "Method", width: 12, value: (r) => paymentMethodLabel(r.method) },
  { header: "Status", width: 11, value: (r) => r.status },
  { header: "Razorpay payment ID", width: 22, value: (r) => r.paymentId },
  { header: "Razorpay subscription ID", width: 24, value: (r) => r.subscriptionId },
  { header: "Razorpay invoice ID", width: 22, value: (r) => r.invoiceId },
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
  fileResponse("payments", "Payments", PAYMENT_COLUMNS, rows, mode, format)

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
