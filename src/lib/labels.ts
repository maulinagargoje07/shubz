/**
 * Human-readable labels for enum values.
 *
 * Enums are stored SCREAMING_SNAKE for stability; every place one is rendered
 * goes through here so "TRADING_FLOOR" never leaks to a screen and the wording
 * is identical on every page.
 */

import type {
  AttendanceStatus,
  EnrollmentStatus,
  LifecycleStage,
  ContactSource,
  PaymentMethod,
} from "@/db/schema"

export const LIFECYCLE_LABELS: Record<LifecycleStage, string> = {
  LEAD: "Lead",
  REGISTERED: "Registered",
  STUDENT: "Student",
  ALUMNI: "Alumni",
  CHURNED: "Churned",
}

export const SOURCE_LABELS: Record<ContactSource, string> = {
  YOUTUBE: "YouTube",
  INSTAGRAM: "Instagram",
  TELEGRAM: "Telegram",
  WEBSITE: "Website",
  REFERRAL: "Referral",
  WALK_IN: "Walk-in",
  ADS: "Ads",
  IMPORT: "Import",
  OTHER: "Other",
}

export const ENROLLMENT_STATUS_LABELS: Record<EnrollmentStatus, string> = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  COMPLETED: "Completed",
  DROPPED: "Dropped",
  CANCELLED: "Cancelled",
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  UPI: "UPI",
  BANK_TRANSFER: "Bank transfer",
  CASH: "Cash",
  CARD: "Card",
  RAZORPAY: "Razorpay",
  CHEQUE: "Cheque",
  OTHER: "Other",
}

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LATE: "Late",
  EXCUSED: "Excused",
}

export const PROGRAM_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  OPEN: "Open",
  ACTIVE: "Active",
  CLOSED: "Closed",
  ARCHIVED: "Archived",
}

export const BATCH_STATUS_LABELS: Record<string, string> = {
  PLANNED: "Planned",
  OPEN: "Open",
  RUNNING: "Running",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
}

export const SESSION_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Scheduled",
  LIVE: "Live",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
}

export const SCHEDULE_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  PARTIAL: "Partly paid",
  PAID: "Paid",
  OVERDUE: "Overdue",
  WAIVED: "Waived",
}

/** Turn any enum record into the {value,label} shape the filter bar wants. */
export function toOptions<T extends string>(
  labels: Record<T, string>
): { value: T; label: string }[] {
  return (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }))
}

/** Badge tone per lifecycle stage, so the list scans at a glance. */
export const LIFECYCLE_TONES: Record<LifecycleStage, string> = {
  LEAD: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  REGISTERED: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  STUDENT: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  ALUMNI: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  CHURNED: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
}
