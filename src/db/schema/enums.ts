/**
 * Every pg enum in the system, in one place so the vocabulary is auditable.
 *
 * Note especially `programTypeEnum` and `deliveryModeEnum`: these are two
 * separate enums on two separate columns, deliberately. Collapsing them into
 * one "MENTORSHIP_OFFLINE" enum would make it impossible to ask "all mentorship
 * regardless of mode" or "everyone who attends offline" without string
 * matching. The UI presents them as a single combined selector; the storage
 * keeps them independent.
 */

import { pgEnum } from "drizzle-orm/pg-core"

// ---------------------------------------------------------------- people

export const lifecycleStageEnum = pgEnum("lifecycle_stage", [
  "LEAD",
  "REGISTERED",
  "STUDENT",
  "ALUMNI",
  "CHURNED",
])

export const contactSourceEnum = pgEnum("contact_source", [
  "YOUTUBE",
  "INSTAGRAM",
  "TELEGRAM",
  "WEBSITE",
  "REFERRAL",
  "WALK_IN",
  "ADS",
  "IMPORT",
  "OTHER",
])

export const consentChannelEnum = pgEnum("consent_channel", [
  "WHATSAPP",
  "EMAIL",
  "SMS",
  "CALL",
])

export const consentActionEnum = pgEnum("consent_action", ["OPT_IN", "OPT_OUT"])

// ------------------------------------------------------------- catalogue

export const programTypeEnum = pgEnum("program_type", [
  "MENTORSHIP",
  "TRADING_FLOOR",
  "WEBINAR",
  "WORKSHOP",
  "COURSE",
])

export const deliveryModeEnum = pgEnum("delivery_mode", ["ONLINE", "OFFLINE"])

export const billingTypeEnum = pgEnum("billing_type", ["ONE_TIME", "RECURRING"])

export const billingCycleEnum = pgEnum("billing_cycle", [
  "MONTHLY",
  "QUARTERLY",
  "HALF_YEARLY",
  "ANNUAL",
])

export const programStatusEnum = pgEnum("program_status", [
  "DRAFT",
  "OPEN",
  "ACTIVE",
  "CLOSED",
  "ARCHIVED",
])

export const batchStatusEnum = pgEnum("batch_status", [
  "PLANNED",
  "OPEN",
  "RUNNING",
  "COMPLETED",
  "CANCELLED",
])

export const sessionStatusEnum = pgEnum("session_status", [
  "SCHEDULED",
  "LIVE",
  "COMPLETED",
  "CANCELLED",
])

// -------------------------------------------------------- enrollment/money

export const enrollmentStatusEnum = pgEnum("enrollment_status", [
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "DROPPED",
  "CANCELLED",
])

export const paymentMethodEnum = pgEnum("payment_method", [
  "UPI",
  "BANK_TRANSFER",
  "CASH",
  "CARD",
  "RAZORPAY",
  "CHEQUE",
  "OTHER",
])

export const paymentScheduleStatusEnum = pgEnum("payment_schedule_status", [
  "PENDING",
  "PARTIAL",
  "PAID",
  "OVERDUE",
  "WAIVED",
])

export const attendanceStatusEnum = pgEnum("attendance_status", [
  "PRESENT",
  "ABSENT",
  "LATE",
  "EXCUSED",
])

export const attendanceSourceEnum = pgEnum("attendance_source", [
  "MANUAL",
  "PHYSICAL_CHECKIN",
  "ZOOM_IMPORT",
])

// ------------------------------------------------------------------- ops

export const userRoleEnum = pgEnum("user_role", ["ADMIN", "MANAGER", "OPERATOR"])

export const importStatusEnum = pgEnum("import_status", [
  "PENDING",
  "MAPPING",
  "VALIDATED",
  "COMMITTED",
  "FAILED",
  "CANCELLED",
])

export const importRowStatusEnum = pgEnum("import_row_status", [
  "VALID",
  "DUPLICATE",
  "INVALID",
  "IMPORTED",
  "SKIPPED",
])

// ------------------------------------------------------------- messaging

export const templateCategoryEnum = pgEnum("template_category", [
  "MARKETING",
  "UTILITY",
  "AUTHENTICATION",
])

export const templateStatusEnum = pgEnum("template_status", [
  "DRAFT",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "PAUSED",
  "DISABLED",
])

export const campaignStatusEnum = pgEnum("campaign_status", [
  "DRAFT",
  "REVIEW",
  "SCHEDULED",
  "QUEUED",
  "PROCESSING",
  "COMPLETED",
  "PARTIALLY_COMPLETED",
  "CANCELLED",
  "FAILED",
])

export const messageDirectionEnum = pgEnum("message_direction", [
  "OUTBOUND",
  "INBOUND",
])

export const messageChannelEnum = pgEnum("message_channel", [
  "WHATSAPP",
  "EMAIL",
  "SMS",
])

export const messageStatusEnum = pgEnum("message_status", [
  "PENDING",
  "QUEUED",
  "PROCESSING",
  "SENT",
  "DELIVERED",
  "READ",
  "FAILED",
])

export const scheduledJobStatusEnum = pgEnum("scheduled_job_status", [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
])
