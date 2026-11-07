"use client"

/**
 * The meetup's registrations as a grid: one row per payment the Payment Page
 * took or declined, the form's answers in their own columns, each row tinted
 * green when paid and red when the attempt failed. Sorts, filters and
 * downloads in the browser like the Customers and Purchases grids; nothing is
 * worked out here, every value is the payments service's.
 */

import { MessageCircle } from "lucide-react"

import { Grid, type GridColumn } from "@/components/grid/grid"
import { RazorpayId } from "@/components/indicator/cells"
import { StatusPill } from "@/components/ui/status"
import { todayIST } from "@/lib/fy"
import {
  EXPERIENCE_LABELS,
  experienceLabel,
  MEETUP_STATUS_LABELS,
  paymentMethodLabel,
  type MeetupRegistration,
} from "@/lib/indicator"
import { formatPhone, phoneDigits } from "@/lib/phone-format"

/** The form's phone as typed, or spaced out when it is a plain Indian number. */
function phoneLabel(raw: string | null): string | null {
  if (!raw) return null
  const digits = phoneDigits(raw)
  if (digits.length === 10) return formatPhone(`+91${digits}`)
  if (digits.length === 12 && digits.startsWith("91")) return formatPhone(`+${digits}`)
  return raw
}

function whatsapp(raw: string): string | null {
  const digits = phoneDigits(raw)
  if (digits.length === 10) return `https://wa.me/91${digits}`
  if (digits.length >= 11 && digits.length <= 15) return `https://wa.me/${digits}`
  return null
}

export function MeetupGrid({
  rows,
  initialFilters,
  initialSearch,
}: {
  rows: MeetupRegistration[]
  initialFilters?: Record<string, string[] | undefined>
  initialSearch?: string
}) {
  const columns: GridColumn<MeetupRegistration>[] = [
    {
      id: "name",
      header: "Name",
      pinned: true,
      value: (r) => r.fullName,
      cell: (r) => (r.fullName ? <span className="font-medium">{r.fullName}</span> : <span className="text-muted-foreground">—</span>),
    },
    {
      id: "status",
      header: "Payment",
      value: (r) => MEETUP_STATUS_LABELS[r.status],
      cell: (r) => (
        <span title={r.status === "failed" ? (r.errorDescription ?? "Payment failed") : undefined}>
          <StatusPill tone={r.status === "captured" ? "paid" : "overdue"}>{MEETUP_STATUS_LABELS[r.status]}</StatusPill>
        </span>
      ),
    },
    { id: "amount", header: "Amount", kind: "money", align: "right", sum: true, value: (r) => (r.status === "captured" ? r.amountPaise : null) },
    { id: "paidAt", header: "Registered", kind: "datetime", value: (r) => r.paidAt },
    { id: "email", header: "Email", value: (r) => r.email },
    {
      id: "phone",
      header: "Contact number",
      value: (r) => phoneLabel(r.contactNumber),
      cell: (r) => {
        if (!r.contactNumber) return <span className="text-muted-foreground">—</span>
        const href = whatsapp(r.contactNumber)
        return (
          <span className="inline-flex items-center gap-1">
            <span className="tabular-nums">{phoneLabel(r.contactNumber)}</span>
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`WhatsApp ${phoneLabel(r.contactNumber)}`}
                title="WhatsApp"
                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-glass-hover hover:text-paid pointer-coarse:size-11"
              >
                <MessageCircle className="size-3.5" aria-hidden />
              </a>
            ) : null}
          </span>
        )
      },
    },
    {
      id: "experience",
      header: "Trading experience",
      value: (r) => (r.experienceLevel ? EXPERIENCE_LABELS[r.experienceLevel] : (r.experience ?? null)),
      cell: (r) => <span>{experienceLabel(r.experienceLevel, r.experience)}</span>,
    },
    { id: "city", header: "City", value: (r) => r.city },
    { id: "method", header: "Method", value: (r) => paymentMethodLabel(r.method) },
    {
      id: "reason",
      header: "Failure reason",
      value: (r) => (r.status === "failed" ? (r.errorDescription ?? r.errorReason ?? "Payment failed") : null),
    },
    { id: "paidOn", header: "Day", kind: "date", value: (r) => r.paidOn },
    {
      id: "paymentId",
      header: "Payment ID",
      value: (r) => r.paymentId,
      cell: (r) => <RazorpayId id={r.paymentId} label="payment ID" />,
    },
    {
      id: "orderId",
      header: "Order ID",
      value: (r) => r.orderId,
      cell: (r) => <RazorpayId id={r.orderId} label="order ID" />,
    },
  ]

  return (
    <Grid
      columns={columns}
      rows={rows}
      rowKey={(r) => r.paymentId}
      rowTone={(r) => (r.status === "captured" ? "active" : "expired")}
      noun="registrations"
      downloadName={`shubztrader-meetup-registrations-${todayIST()}`}
      initialSort={{ id: "paidAt", dir: "desc" }}
      initialFilters={initialFilters}
      initialSearch={initialSearch}
      emptyMessage="Registrations appear here the moment Razorpay confirms a payment on the meetup page."
    />
  )
}
