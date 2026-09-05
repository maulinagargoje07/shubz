/**
 * Program type + delivery mode.
 *
 * Storage keeps `type` and `delivery_mode` as two independent columns so that
 * "all mentorship regardless of mode" and "everyone who attends offline" are
 * both plain indexed queries. The UI, however, only ever presents them as ONE
 * combined selector — nobody thinks of "Trading Floor" and "Offline" as two
 * decisions. This module is the bridge between those two views.
 *
 * The seven combinations are an explicit list, not a cross product: there is
 * no offline webinar and no online workshop in this business.
 */

import type { BillingCycle, BillingType, DeliveryMode, ProgramType } from "@/db/schema"

export type ProgramKind = `${ProgramType}__${DeliveryMode}`

export type ProgramKindOption = {
  value: ProgramKind
  /** How the combined selector reads: "Trading Floor — Offline". */
  label: string
  type: ProgramType
  deliveryMode: DeliveryMode
  /** Pre-filled when this kind is chosen. The user may override any of it. */
  defaults: {
    billingType: BillingType
    billingCycle: BillingCycle | null
    feePaise: number | null
  }
}

export const PROGRAM_KINDS: readonly ProgramKindOption[] = [
  {
    value: "MENTORSHIP__ONLINE",
    label: "Mentorship — Online",
    type: "MENTORSHIP",
    deliveryMode: "ONLINE",
    defaults: { billingType: "ONE_TIME", billingCycle: null, feePaise: null },
  },
  {
    value: "MENTORSHIP__OFFLINE",
    label: "Mentorship — Offline",
    type: "MENTORSHIP",
    deliveryMode: "OFFLINE",
    defaults: { billingType: "ONE_TIME", billingCycle: null, feePaise: null },
  },
  {
    value: "TRADING_FLOOR__ONLINE",
    label: "Trading Floor — Online",
    type: "TRADING_FLOOR",
    deliveryMode: "ONLINE",
    defaults: { billingType: "RECURRING", billingCycle: "MONTHLY", feePaise: null },
  },
  {
    value: "TRADING_FLOOR__OFFLINE",
    label: "Trading Floor — Offline",
    type: "TRADING_FLOOR",
    deliveryMode: "OFFLINE",
    defaults: { billingType: "RECURRING", billingCycle: "MONTHLY", feePaise: null },
  },
  {
    value: "WEBINAR__ONLINE",
    label: "Webinar — Online",
    type: "WEBINAR",
    deliveryMode: "ONLINE",
    // Webinars are the free top of the funnel; fee defaults to zero.
    defaults: { billingType: "ONE_TIME", billingCycle: null, feePaise: 0 },
  },
  {
    value: "WORKSHOP__OFFLINE",
    label: "Workshop — Offline",
    type: "WORKSHOP",
    deliveryMode: "OFFLINE",
    defaults: { billingType: "ONE_TIME", billingCycle: null, feePaise: null },
  },
  {
    value: "COURSE__ONLINE",
    label: "Course — Online",
    type: "COURSE",
    deliveryMode: "ONLINE",
    defaults: { billingType: "ONE_TIME", billingCycle: null, feePaise: null },
  },
] as const

export const PROGRAM_KIND_VALUES = PROGRAM_KINDS.map((k) => k.value) as [
  ProgramKind,
  ...ProgramKind[],
]

export function toProgramKind(
  type: ProgramType,
  deliveryMode: DeliveryMode
): ProgramKind {
  return `${type}__${deliveryMode}`
}

export function findProgramKind(kind: ProgramKind): ProgramKindOption | undefined {
  return PROGRAM_KINDS.find((k) => k.value === kind)
}

/** Split a combined selector value back into the two columns it writes. */
export function splitProgramKind(kind: ProgramKind): {
  type: ProgramType
  deliveryMode: DeliveryMode
} {
  const [type, deliveryMode] = kind.split("__") as [ProgramType, DeliveryMode]
  return { type, deliveryMode }
}

const TYPE_LABELS: Record<ProgramType, string> = {
  MENTORSHIP: "Mentorship",
  TRADING_FLOOR: "Trading Floor",
  WEBINAR: "Webinar",
  WORKSHOP: "Workshop",
  COURSE: "Course",
}

const MODE_LABELS: Record<DeliveryMode, string> = {
  ONLINE: "Online",
  OFFLINE: "Offline",
}

export function programTypeLabel(type: ProgramType): string {
  return TYPE_LABELS[type]
}

export function deliveryModeLabel(mode: DeliveryMode): string {
  return MODE_LABELS[mode]
}

/**
 * "Mentorship (Offline)" — the canonical way a program's kind is displayed
 * EVERYWHERE: lists, contact profile, enrollment rows, receipts. Use this
 * rather than rendering the two columns separately, so the phrasing never
 * drifts between pages.
 */
export function programKindLabel(
  program: Pick<{ type: ProgramType; deliveryMode: DeliveryMode }, "type" | "deliveryMode">
): string {
  return `${TYPE_LABELS[program.type]} (${MODE_LABELS[program.deliveryMode]})`
}

/** "SMC Mentorship Pune — Mentorship (Offline)" for pickers and receipts. */
export function programLabel(
  program: { name: string; type: ProgramType; deliveryMode: DeliveryMode }
): string {
  return `${program.name} — ${programKindLabel(program)}`
}

const CYCLE_LABELS: Record<BillingCycle, string> = {
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  HALF_YEARLY: "Half-yearly",
  ANNUAL: "Annual",
}

export function billingCycleLabel(cycle: BillingCycle): string {
  return CYCLE_LABELS[cycle]
}

export const BILLING_CYCLES = Object.keys(CYCLE_LABELS) as BillingCycle[]

/** Months advanced by one cycle. Drives next_due_date and schedule generation. */
export const CYCLE_MONTHS: Record<BillingCycle, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  HALF_YEARLY: 6,
  ANNUAL: 12,
}
