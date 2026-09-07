/**
 * Lead vocabulary — labels and the tone each status carries in the UI.
 *
 * Kept next to the money and program label maps rather than inside a component
 * so the leads list, the contact page and the CSV export all name a status the
 * same way. A status that reads "Not interested" in one place and "Dropped" in
 * another is a status nobody trusts.
 */

export const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "INTERESTED",
  "NOT_INTERESTED",
  "CONVERTED",
] as const

export type LeadStatus = (typeof LEAD_STATUSES)[number]

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  INTERESTED: "Interested",
  NOT_INTERESTED: "Not interested",
  CONVERTED: "Converted",
}

/**
 * What each status means in practice, shown next to the choice so two people
 * working the same list apply them the same way.
 */
export const LEAD_STATUS_DESCRIPTIONS: Record<LeadStatus, string> = {
  NEW: "Imported, nobody has reached out yet.",
  CONTACTED: "We have messaged or called; no reply yet.",
  INTERESTED: "Replied and wants to know more. Worth chasing.",
  NOT_INTERESTED: "Said no, or asked not to be contacted again.",
  CONVERTED: "Enrolled in a program.",
}

/** Maps onto the StatusPill tones already used for fees and attendance. */
export const LEAD_STATUS_TONES: Record<
  LeadStatus,
  "info" | "pending" | "paid" | "overdue" | "muted"
> = {
  NEW: "info",
  CONTACTED: "pending",
  INTERESTED: "paid",
  NOT_INTERESTED: "muted",
  CONVERTED: "paid",
}

/**
 * The lifecycle stages that count as "still a lead".
 *
 * Someone who has enrolled is a student and belongs on the students list, not
 * in the pipeline — but they stay reachable here through the "include
 * converted" filter, because "who did this campaign actually convert" is a
 * question worth being able to ask.
 */
export const LEAD_STAGES = ["LEAD", "REGISTERED"] as const

/**
 * Trading experience arrives as free text from a form, so it is grouped for
 * display rather than parsed. The order is deliberate: least experienced
 * first, matching how the business talks about its funnel.
 */
export function experienceRank(value: string | null): number {
  if (!value) return 99
  const text = value.toLowerCase()
  if (text.startsWith("beginner") || text.includes("just start")) return 0
  if (text.startsWith("intermediate")) return 1
  if (text.startsWith("advance")) return 2
  return 50
}
