import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, lte, or, sql } from "drizzle-orm"

import { db } from "@/db"
import { contactTags, contacts, tags } from "@/db/schema"
import { LEAD_STAGES, type LeadStatus } from "@/lib/leads"

export type LeadFilters = {
  q?: string
  status?: LeadStatus
  source?: string
  /** Tag id — the list a lead was imported into. */
  list?: string
  experience?: string
  /** Inclusive "yyyy-MM-dd" bounds on when the lead was captured. */
  from?: string
  to?: string
  /** Include people who have since become students. Off by default. */
  includeConverted?: boolean
}

export type LeadListParams = LeadFilters & {
  page: number
  perPage: number
  sort?: "captured" | "name" | "status"
  dir?: "asc" | "desc"
}

export type LeadRow = {
  id: string
  fullName: string
  phoneE164: string
  email: string | null
  city: string | null
  source: string
  leadStatus: LeadStatus
  lifecycleStage: string
  tradingExperience: string | null
  leadCapturedAt: Date | null
  createdAt: Date
  lists: string[]
}

/**
 * The shared WHERE for every lead read.
 *
 * Extracted rather than repeated because the list, the count and the export
 * must agree exactly. When these drifted apart elsewhere in this codebase the
 * symptom was a total that did not match the rows underneath it, which is the
 * kind of bug nobody reports and everybody stops trusting the page over.
 */
function leadConditions(filters: LeadFilters) {
  const conditions = [isNull(contacts.deletedAt)]

  if (!filters.includeConverted) {
    conditions.push(inArray(contacts.lifecycleStage, [...LEAD_STAGES]))
  }

  if (filters.q) {
    const term = `%${filters.q}%`
    const digits = filters.q.replace(/\D/g, "")
    const clauses = [
      ilike(contacts.fullName, term),
      ilike(contacts.email, term),
      ilike(contacts.phoneE164, term),
      ilike(contacts.phoneRaw, term),
    ]
    // People search by the number as printed on a sheet, not as stored.
    if (digits.length >= 4) {
      clauses.push(
        sql`regexp_replace(${contacts.phoneE164}, '\\D', '', 'g') like ${`%${digits}%`}`
      )
    }
    conditions.push(or(...clauses)!)
  }

  if (filters.status) conditions.push(eq(contacts.leadStatus, filters.status))
  if (filters.source) {
    conditions.push(sql`${contacts.source}::text = ${filters.source}`)
  }
  if (filters.experience) {
    conditions.push(eq(contacts.tradingExperience, filters.experience))
  }

  /*
   * Capture dates are compared in IST. The column is an instant, so a bare
   * date bound would cut the day at 05:30 local and quietly drop the first
   * five and a half hours of it from every "captured today" filter.
   */
  if (filters.from) {
    conditions.push(
      gte(
        sql`(${contacts.leadCapturedAt} at time zone 'Asia/Kolkata')::date`,
        sql`${filters.from}::date`
      )
    )
  }
  if (filters.to) {
    conditions.push(
      lte(
        sql`(${contacts.leadCapturedAt} at time zone 'Asia/Kolkata')::date`,
        sql`${filters.to}::date`
      )
    )
  }

  /*
   * List membership is a join through contact_tags. Expressed as an EXISTS so
   * a lead in two lists is still one row — a plain join would duplicate them
   * and inflate both the page and the count.
   */
  if (filters.list) {
    conditions.push(
      sql`exists (
        select 1 from ${contactTags} ct
        where ct.contact_id = contacts.id and ct.tag_id = ${filters.list}::uuid
      )`
    )
  }

  return and(...conditions)
}

export async function listLeads(params: LeadListParams): Promise<{
  rows: LeadRow[]
  total: number
}> {
  const { page, perPage, sort = "captured", dir = "desc" } = params
  const where = leadConditions(params)

  const direction = dir === "asc" ? asc : desc
  const orderBy =
    sort === "name"
      ? [direction(contacts.fullName)]
      : sort === "status"
        ? [direction(contacts.leadStatus), desc(contacts.createdAt)]
        : // Captured-at is null for anything not imported from a sheet, so fall
          // back to when the row was created rather than sorting nulls together.
          [direction(sql`coalesce(${contacts.leadCapturedAt}, ${contacts.createdAt})`)]

  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: contacts.id,
        fullName: contacts.fullName,
        phoneE164: contacts.phoneE164,
        email: contacts.email,
        city: contacts.city,
        source: sql<string>`${contacts.source}::text`,
        leadStatus: sql<LeadStatus>`${contacts.leadStatus}::text`,
        lifecycleStage: sql<string>`${contacts.lifecycleStage}::text`,
        tradingExperience: contacts.tradingExperience,
        leadCapturedAt: contacts.leadCapturedAt,
        createdAt: contacts.createdAt,
        /*
         * Aggregated in the same query: fetching tags per row would turn a
         * 50-row page into 51 queries.
         *
         * The correlation is written as literal `contacts.id` rather than
         * interpolated. Drizzle renders `${contacts.id}` as a bare "id", which
         * inside this subquery binds to the joined tags table's own id column —
         * so the condition silently became ct.contact_id = t.id, matched
         * nothing, and every row came back with no lists at all. No error, just
         * an empty column.
         */
        lists: sql<string[]>`coalesce(
          (select array_agg(t.name order by t.name)
             from ${contactTags} ct
             join ${tags} t on t.id = ct.tag_id
            where ct.contact_id = contacts.id),
          '{}'
        )`,
      })
      .from(contacts)
      .where(where)
      .orderBy(...orderBy)
      .limit(perPage)
      .offset((page - 1) * perPage),
    db.select({ value: count() }).from(contacts).where(where),
  ])

  return { rows, total: Number(totals?.value ?? 0) }
}

export type LeadStats = {
  total: number
  new: number
  contacted: number
  interested: number
  notInterested: number
  converted: number
  capturedThisMonth: number
}

/**
 * The counts above the list.
 *
 * One pass with FILTER clauses rather than six queries: the numbers are then
 * guaranteed to be from the same instant, and a busy list page stays one round
 * trip. These deliberately ignore the active filters — they describe the whole
 * pipeline, which is what makes them a useful backdrop to a filtered view.
 */
export async function leadStats(): Promise<LeadStats> {
  const [row] = await db
    .select({
      total: sql<number>`count(*) filter (
        where ${contacts.lifecycleStage}::text in ('LEAD', 'REGISTERED'))::int`,
      new: sql<number>`count(*) filter (
        where ${contacts.leadStatus} = 'NEW'
          and ${contacts.lifecycleStage}::text in ('LEAD', 'REGISTERED'))::int`,
      contacted: sql<number>`count(*) filter (
        where ${contacts.leadStatus} = 'CONTACTED'
          and ${contacts.lifecycleStage}::text in ('LEAD', 'REGISTERED'))::int`,
      interested: sql<number>`count(*) filter (
        where ${contacts.leadStatus} = 'INTERESTED'
          and ${contacts.lifecycleStage}::text in ('LEAD', 'REGISTERED'))::int`,
      notInterested: sql<number>`count(*) filter (
        where ${contacts.leadStatus} = 'NOT_INTERESTED'
          and ${contacts.lifecycleStage}::text in ('LEAD', 'REGISTERED'))::int`,
      converted: sql<number>`count(*) filter (where ${contacts.leadStatus} = 'CONVERTED')::int`,
      capturedThisMonth: sql<number>`count(*) filter (
        where date_trunc('month', ${contacts.leadCapturedAt} at time zone 'Asia/Kolkata')
            = date_trunc('month', (now() at time zone 'Asia/Kolkata')))::int`,
    })
    .from(contacts)
    .where(isNull(contacts.deletedAt))

  return {
    total: Number(row?.total ?? 0),
    new: Number(row?.new ?? 0),
    contacted: Number(row?.contacted ?? 0),
    interested: Number(row?.interested ?? 0),
    notInterested: Number(row?.notInterested ?? 0),
    converted: Number(row?.converted ?? 0),
    capturedThisMonth: Number(row?.capturedThisMonth ?? 0),
  }
}

/** Lists (tags) that actually hold at least one lead, with their sizes. */
export async function leadListOptions(): Promise<
  { value: string; label: string; count: number }[]
> {
  const rows = await db
    .select({
      value: tags.id,
      label: tags.name,
      count: sql<number>`count(${contactTags.contactId})::int`,
    })
    .from(tags)
    .innerJoin(contactTags, eq(contactTags.tagId, tags.id))
    .innerJoin(
      contacts,
      and(eq(contacts.id, contactTags.contactId), isNull(contacts.deletedAt))
    )
    .groupBy(tags.id, tags.name)
    .orderBy(asc(tags.name))

  return rows.map((r) => ({ ...r, count: Number(r.count) }))
}

/**
 * The distinct experience answers present in the data.
 *
 * Read from the rows rather than a fixed list because the wording is whatever
 * the Google Form offered on the day, and it changes between campaigns.
 */
export async function leadExperienceOptions(): Promise<
  { value: string; count: number }[]
> {
  const rows = await db
    .select({
      value: contacts.tradingExperience,
      count: sql<number>`count(*)::int`,
    })
    .from(contacts)
    .where(and(isNull(contacts.deletedAt), sql`${contacts.tradingExperience} is not null`))
    .groupBy(contacts.tradingExperience)
    .orderBy(desc(sql`count(*)`))

  return rows
    .filter((r): r is { value: string; count: number } => Boolean(r.value))
    .map((r) => ({ value: r.value, count: Number(r.count) }))
}

/** Every lead matching the filters, for the CSV export and bulk actions. */
export async function leadIdsMatching(filters: LeadFilters): Promise<string[]> {
  const rows = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(leadConditions(filters))
  return rows.map((r) => r.id)
}

export async function leadsForExport(filters: LeadFilters): Promise<LeadRow[]> {
  return db
    .select({
      id: contacts.id,
      fullName: contacts.fullName,
      phoneE164: contacts.phoneE164,
      email: contacts.email,
      city: contacts.city,
      source: sql<string>`${contacts.source}::text`,
      leadStatus: sql<LeadStatus>`${contacts.leadStatus}::text`,
      lifecycleStage: sql<string>`${contacts.lifecycleStage}::text`,
      tradingExperience: contacts.tradingExperience,
      leadCapturedAt: contacts.leadCapturedAt,
      createdAt: contacts.createdAt,
      // Literal `contacts.id` for the same reason as in listLeads above.
      lists: sql<string[]>`coalesce(
        (select array_agg(t.name order by t.name)
           from ${contactTags} ct
           join ${tags} t on t.id = ct.tag_id
          where ct.contact_id = contacts.id),
        '{}'
      )`,
    })
    .from(contacts)
    .where(leadConditions(filters))
    .orderBy(desc(sql`coalesce(${contacts.leadCapturedAt}, ${contacts.createdAt})`))
}
