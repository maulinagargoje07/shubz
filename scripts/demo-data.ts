/**
 * Demo data — additive and reversible.
 *
 * This is deliberately NOT `scripts/seed.ts`. That script truncates the
 * database to rebuild a clean fixture, which is right for a fresh dev database
 * and catastrophic for this one: the portal is live and already holds real
 * students, real payments and real user accounts. Nothing here deletes or
 * modifies a row it did not create.
 *
 *   npm run db:demo            add the demo records
 *   npm run db:demo -- --remove   take every one of them back out
 *   npm run db:demo -- --force    remove then re-add (a clean re-run)
 *
 * Everything created is tagged so removal is exact rather than heuristic:
 *   - contacts carry the "Demo data" tag
 *   - batches carry a DEMO- prefix on their unique code
 * Enrollments, schedule rows, payments, attendance, notes and consent events
 * all hang off those two anchors, so they come out with them.
 *
 * The numbers are chosen to exercise the portal rather than to look tidy:
 * fully paid, part paid and overdue enrollments all exist; some held sessions
 * are deliberately left without a register so the "held without a register"
 * warning has something to report; one batch is COMPLETED and one session
 * CANCELLED so the status filters have something to exclude.
 */

import { config } from "dotenv"

config({ path: ".env", quiet: true })

import { drizzle } from "drizzle-orm/node-postgres"
import { and, eq, inArray, like, sql } from "drizzle-orm"
import { Pool } from "pg"

import * as schema from "../src/db/schema"
import { planSchedule } from "../src/lib/billing"
import { financialYear } from "../src/lib/fy"
import { newId } from "../src/lib/ids"
import { toPaise } from "../src/lib/money"

const {
  contacts,
  programs,
  batches,
  classSessions,
  enrollments,
  payments,
  paymentSchedule,
  attendance,
  tags,
  contactTags,
  consentEvents,
  notes,
  users,
} = schema

/** The tag that marks a contact as demo. Removal keys on exactly this name. */
const DEMO_TAG = "Demo data"
/** Batch codes are unique, so a prefix is a reliable anchor for removal. */
const DEMO_CODE_PREFIX = "DEMO-"

// --------------------------------------------------------------- date help

/** "yyyy-MM-dd", N days before today. */
function daysAgo(n: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

function daysAhead(n: number): string {
  return daysAgo(-n)
}

/** An instant N days from now at a given IST wall-clock time. */
function istAt(daysFromNow: number, hour: number, minute = 0): Date {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + daysFromNow)
  const ymd = d.toISOString().slice(0, 10)
  const hh = String(hour).padStart(2, "0")
  const mm = String(minute).padStart(2, "0")
  return new Date(`${ymd}T${hh}:${mm}:00+05:30`)
}

// ----------------------------------------------------------------- people

type DemoContact = {
  name: string
  /** Last 10 digits; +91 is prepended. */
  phone: string
  city: string
  stage: "LEAD" | "REGISTERED" | "STUDENT" | "ALUMNI" | "CHURNED"
  source:
    | "YOUTUBE"
    | "INSTAGRAM"
    | "TELEGRAM"
    | "WEBSITE"
    | "REFERRAL"
    | "WALK_IN"
    | "ADS"
  email?: string
}

/**
 * Names and cities are drawn from the catchment the business actually serves,
 * so the lists look like the real thing when judging spacing and truncation.
 * The phone block 88061000xx is contiguous and unmistakably sequential, which
 * makes demo rows obvious at a glance in the contacts list.
 */
const DEMO_CONTACTS: DemoContact[] = [
  // --- enrolled students (0-23)
  { name: "Aditya Kulkarni", phone: "8806100001", city: "Pune", stage: "STUDENT", source: "YOUTUBE", email: "aditya.kulkarni@example.in" },
  { name: "Sneha Deshpande", phone: "8806100002", city: "Pune", stage: "STUDENT", source: "INSTAGRAM", email: "sneha.d@example.in" },
  { name: "Rohit Jadhav", phone: "8806100003", city: "Pimpri-Chinchwad", stage: "STUDENT", source: "REFERRAL" },
  { name: "Priya Patil", phone: "8806100004", city: "Pune", stage: "STUDENT", source: "YOUTUBE", email: "priya.patil@example.in" },
  { name: "Nikhil Shinde", phone: "8806100005", city: "Nashik", stage: "STUDENT", source: "TELEGRAM" },
  { name: "Ashwini Joshi", phone: "8806100006", city: "Pune", stage: "STUDENT", source: "WALK_IN", email: "ashwini.joshi@example.in" },
  { name: "Sagar Pawar", phone: "8806100007", city: "Kharadi, Pune", stage: "STUDENT", source: "WALK_IN" },
  { name: "Meera Iyer", phone: "8806100008", city: "Mumbai", stage: "STUDENT", source: "INSTAGRAM", email: "meera.iyer@example.in" },
  { name: "Kunal Bhosale", phone: "8806100009", city: "Pune", stage: "STUDENT", source: "ADS" },
  { name: "Tejas Gaikwad", phone: "8806100010", city: "Pune", stage: "STUDENT", source: "YOUTUBE" },
  { name: "Shruti Kale", phone: "8806100011", city: "Nagpur", stage: "STUDENT", source: "WEBSITE", email: "shruti.kale@example.in" },
  { name: "Omkar Sawant", phone: "8806100012", city: "Pune", stage: "STUDENT", source: "REFERRAL" },
  { name: "Ritika Agarwal", phone: "8806100013", city: "Mumbai", stage: "STUDENT", source: "INSTAGRAM" },
  { name: "Harshad More", phone: "8806100014", city: "Kharadi, Pune", stage: "STUDENT", source: "WALK_IN" },
  { name: "Pooja Chavan", phone: "8806100015", city: "Pune", stage: "STUDENT", source: "YOUTUBE", email: "pooja.chavan@example.in" },
  { name: "Amit Ranade", phone: "8806100016", city: "Pune", stage: "STUDENT", source: "TELEGRAM" },
  { name: "Vaishnavi Salunkhe", phone: "8806100017", city: "Satara", stage: "STUDENT", source: "REFERRAL" },
  { name: "Yogesh Thakur", phone: "8806100018", city: "Kharadi, Pune", stage: "STUDENT", source: "WALK_IN" },
  { name: "Ananya Rao", phone: "8806100019", city: "Bengaluru", stage: "STUDENT", source: "WEBSITE", email: "ananya.rao@example.in" },
  { name: "Siddharth Naik", phone: "8806100020", city: "Pune", stage: "STUDENT", source: "ADS" },
  { name: "Manasi Kulkarni", phone: "8806100021", city: "Pune", stage: "STUDENT", source: "YOUTUBE" },
  { name: "Rahul Wagh", phone: "8806100022", city: "Pimpri-Chinchwad", stage: "STUDENT", source: "REFERRAL" },
  { name: "Ishita Mehta", phone: "8806100023", city: "Mumbai", stage: "STUDENT", source: "INSTAGRAM" },
  { name: "Prathamesh Dhole", phone: "8806100024", city: "Kharadi, Pune", stage: "STUDENT", source: "WALK_IN" },

  // --- not enrolled: leads and registrations, so the funnel filters have data
  { name: "Sanket Bhalerao", phone: "8806100025", city: "Pune", stage: "LEAD", source: "YOUTUBE" },
  { name: "Deepika Shah", phone: "8806100026", city: "Mumbai", stage: "LEAD", source: "INSTAGRAM", email: "deepika.shah@example.in" },
  { name: "Aniket Mane", phone: "8806100027", city: "Nashik", stage: "LEAD", source: "ADS" },
  { name: "Gauri Kadam", phone: "8806100028", city: "Pune", stage: "LEAD", source: "WEBSITE" },
  { name: "Vikram Suryavanshi", phone: "8806100029", city: "Kolhapur", stage: "LEAD", source: "TELEGRAM" },
  { name: "Neha Bansode", phone: "8806100030", city: "Pune", stage: "REGISTERED", source: "YOUTUBE", email: "neha.b@example.in" },
  { name: "Chinmay Apte", phone: "8806100031", city: "Pune", stage: "REGISTERED", source: "REFERRAL" },
  { name: "Snehal Borkar", phone: "8806100032", city: "Nagpur", stage: "REGISTERED", source: "WEBSITE" },

  // --- past students, so Alumni / Churned are not empty states
  { name: "Mandar Ghorpade", phone: "8806100033", city: "Pune", stage: "ALUMNI", source: "REFERRAL" },
  { name: "Kavita Sathe", phone: "8806100034", city: "Pune", stage: "ALUMNI", source: "YOUTUBE" },
  { name: "Rupesh Tiwari", phone: "8806100035", city: "Mumbai", stage: "CHURNED", source: "ADS" },
  { name: "Aarti Nimbalkar", phone: "8806100036", city: "Pune", stage: "CHURNED", source: "INSTAGRAM" },
]

// ------------------------------------------------------------- enrollments

type DemoPlan = {
  /** Index into DEMO_CONTACTS. */
  who: number
  /** Which of the four real programs. */
  program: "MEN_ON" | "MEN_OFF" | "TF_ON" | "TF_OFF"
  /** Which demo batch, or null for a batchless membership. */
  batch: "MEN_ON_B25" | "MEN_ON_B23" | "MEN_OFF_B5" | "TF_ON" | "TF_OFF" | null
  startedDaysAgo: number
  feeRupees: number
  discountRupees?: number
  installments: number
  /** Rupees actually received. Less than the fee leaves a balance. */
  paidRupees: number
  /** Spread the receipts, so a payment history exists rather than one row. */
  paymentCount: number
  seat?: string
  recurring?: boolean
  status?: "ACTIVE" | "COMPLETED" | "DROPPED"
}

/**
 * The mix here is the point of the whole script. Across the 28 rows there are
 * enrollments that are settled, part paid, and badly overdue; one-time fees and
 * monthly memberships; discounts; seats; and a batchless membership. If the
 * fees dashboard, the overdue list and the balance view all agree on these,
 * they agree on anything.
 */
const DEMO_PLANS: DemoPlan[] = [
  // Mentorship (Online) — B25, currently running
  { who: 0, program: "MEN_ON", batch: "MEN_ON_B25", startedDaysAgo: 40, feeRupees: 45000, installments: 3, paidRupees: 45000, paymentCount: 3 },
  { who: 1, program: "MEN_ON", batch: "MEN_ON_B25", startedDaysAgo: 40, feeRupees: 45000, installments: 3, paidRupees: 30000, paymentCount: 2 },
  { who: 2, program: "MEN_ON", batch: "MEN_ON_B25", startedDaysAgo: 85, feeRupees: 45000, installments: 3, paidRupees: 15000, paymentCount: 1 },
  { who: 3, program: "MEN_ON", batch: "MEN_ON_B25", startedDaysAgo: 40, feeRupees: 45000, discountRupees: 5000, installments: 1, paidRupees: 40000, paymentCount: 1 },
  { who: 4, program: "MEN_ON", batch: "MEN_ON_B25", startedDaysAgo: 95, feeRupees: 45000, installments: 3, paidRupees: 0, paymentCount: 0 },
  { who: 5, program: "MEN_ON", batch: "MEN_ON_B25", startedDaysAgo: 30, feeRupees: 45000, installments: 2, paidRupees: 22500, paymentCount: 1 },
  { who: 6, program: "MEN_ON", batch: "MEN_ON_B25", startedDaysAgo: 25, feeRupees: 45000, installments: 1, paidRupees: 45000, paymentCount: 1 },

  // Mentorship (Online) — B23, a finished batch
  { who: 32, program: "MEN_ON", batch: "MEN_ON_B23", startedDaysAgo: 220, feeRupees: 40000, installments: 2, paidRupees: 40000, paymentCount: 2, status: "COMPLETED" },
  { who: 33, program: "MEN_ON", batch: "MEN_ON_B23", startedDaysAgo: 220, feeRupees: 40000, installments: 2, paidRupees: 40000, paymentCount: 2, status: "COMPLETED" },
  { who: 34, program: "MEN_ON", batch: "MEN_ON_B23", startedDaysAgo: 210, feeRupees: 40000, installments: 2, paidRupees: 20000, paymentCount: 1, status: "DROPPED" },

  // Mentorship (Offline) — B5 at Kharadi, with seats
  { who: 7, program: "MEN_OFF", batch: "MEN_OFF_B5", startedDaysAgo: 35, feeRupees: 55000, installments: 3, paidRupees: 55000, paymentCount: 3, seat: "D-01" },
  { who: 8, program: "MEN_OFF", batch: "MEN_OFF_B5", startedDaysAgo: 35, feeRupees: 55000, discountRupees: 5000, installments: 3, paidRupees: 25000, paymentCount: 2, seat: "D-02" },
  { who: 9, program: "MEN_OFF", batch: "MEN_OFF_B5", startedDaysAgo: 80, feeRupees: 55000, installments: 3, paidRupees: 18000, paymentCount: 1, seat: "D-03" },
  { who: 10, program: "MEN_OFF", batch: "MEN_OFF_B5", startedDaysAgo: 35, feeRupees: 55000, installments: 1, paidRupees: 55000, paymentCount: 1, seat: "D-04" },
  { who: 11, program: "MEN_OFF", batch: "MEN_OFF_B5", startedDaysAgo: 70, feeRupees: 55000, installments: 3, paidRupees: 0, paymentCount: 0, seat: "D-05" },
  { who: 12, program: "MEN_OFF", batch: "MEN_OFF_B5", startedDaysAgo: 20, feeRupees: 55000, installments: 2, paidRupees: 27500, paymentCount: 1, seat: "D-06" },

  // Trading Floor (Online) — monthly membership
  { who: 13, program: "TF_ON", batch: "TF_ON", startedDaysAgo: 150, feeRupees: 5000, installments: 1, paidRupees: 25000, paymentCount: 5, recurring: true },
  { who: 14, program: "TF_ON", batch: "TF_ON", startedDaysAgo: 120, feeRupees: 5000, installments: 1, paidRupees: 20000, paymentCount: 4, recurring: true },
  { who: 15, program: "TF_ON", batch: "TF_ON", startedDaysAgo: 100, feeRupees: 5000, installments: 1, paidRupees: 5000, paymentCount: 1, recurring: true },
  { who: 16, program: "TF_ON", batch: "TF_ON", startedDaysAgo: 60, feeRupees: 5000, installments: 1, paidRupees: 10000, paymentCount: 2, recurring: true },
  // Batchless membership — the schema allows it and the UI must cope.
  { who: 17, program: "TF_ON", batch: null, startedDaysAgo: 45, feeRupees: 5000, installments: 1, paidRupees: 5000, paymentCount: 1, recurring: true },

  // Trading Floor (Offline) — Kharadi desks
  { who: 18, program: "TF_OFF", batch: "TF_OFF", startedDaysAgo: 150, feeRupees: 8000, installments: 1, paidRupees: 40000, paymentCount: 5, recurring: true, seat: "K-01" },
  { who: 19, program: "TF_OFF", batch: "TF_OFF", startedDaysAgo: 120, feeRupees: 8000, installments: 1, paidRupees: 24000, paymentCount: 3, recurring: true, seat: "K-02" },
  { who: 20, program: "TF_OFF", batch: "TF_OFF", startedDaysAgo: 130, feeRupees: 8000, installments: 1, paidRupees: 16000, paymentCount: 2, recurring: true, seat: "K-03" },
  { who: 21, program: "TF_OFF", batch: "TF_OFF", startedDaysAgo: 90, feeRupees: 8000, installments: 1, paidRupees: 24000, paymentCount: 3, recurring: true, seat: "K-04" },
  { who: 22, program: "TF_OFF", batch: "TF_OFF", startedDaysAgo: 75, feeRupees: 8000, installments: 1, paidRupees: 0, paymentCount: 0, recurring: true, seat: "K-05" },
  { who: 23, program: "TF_OFF", batch: "TF_OFF", startedDaysAgo: 30, feeRupees: 8000, installments: 1, paidRupees: 8000, paymentCount: 1, recurring: true, seat: "K-06" },
]

// ------------------------------------------------------------------ remove

/**
 * Delete everything this script created, in FK-safe order.
 *
 * Written as its own function because it runs in three situations: an explicit
 * --remove, a --force re-run, and the guard that stops a second add from
 * duplicating rows.
 */
async function removeDemo(db: ReturnType<typeof drizzle<typeof schema>>) {
  const [tag] = await db.select().from(tags).where(eq(tags.name, DEMO_TAG))

  let contactIds: string[] = []
  if (tag) {
    const links = await db
      .select({ contactId: contactTags.contactId })
      .from(contactTags)
      .where(eq(contactTags.tagId, tag.id))
    contactIds = links.map((l) => l.contactId)
  }

  let removedEnrollments = 0
  if (contactIds.length > 0) {
    const es = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(inArray(enrollments.contactId, contactIds))
    const enrollmentIds = es.map((e) => e.id)
    removedEnrollments = enrollmentIds.length

    if (enrollmentIds.length > 0) {
      await db.delete(attendance).where(inArray(attendance.enrollmentId, enrollmentIds))
      await db.delete(paymentSchedule).where(inArray(paymentSchedule.enrollmentId, enrollmentIds))
      await db.delete(payments).where(inArray(payments.enrollmentId, enrollmentIds))
      await db.delete(enrollments).where(inArray(enrollments.id, enrollmentIds))
    }

    await db.delete(notes).where(inArray(notes.contactId, contactIds))
    await db.delete(consentEvents).where(inArray(consentEvents.contactId, contactIds))
    await db.delete(contactTags).where(inArray(contactTags.contactId, contactIds))
    await db.delete(contacts).where(inArray(contacts.id, contactIds))
  }

  // Batches last: an enrollment belonging to a REAL contact could point at a
  // demo batch if someone moved one, and batch_id is ON DELETE SET NULL, so
  // that enrollment survives with no batch rather than being destroyed.
  const demoBatches = await db
    .select({ id: batches.id })
    .from(batches)
    .where(like(batches.code, `${DEMO_CODE_PREFIX}%`))
  const batchIds = demoBatches.map((b) => b.id)

  let removedSessions = 0
  if (batchIds.length > 0) {
    const ss = await db
      .select({ id: classSessions.id })
      .from(classSessions)
      .where(inArray(classSessions.batchId, batchIds))
    removedSessions = ss.length
    if (ss.length > 0) {
      await db.delete(attendance).where(inArray(attendance.sessionId, ss.map((s) => s.id)))
      await db.delete(classSessions).where(inArray(classSessions.batchId, batchIds))
    }
    await db.delete(batches).where(inArray(batches.id, batchIds))
  }

  if (tag) {
    await db.delete(contactTags).where(eq(contactTags.tagId, tag.id))
    await db.delete(tags).where(eq(tags.id, tag.id))
  }

  return {
    contacts: contactIds.length,
    enrollments: removedEnrollments,
    batches: batchIds.length,
    sessions: removedSessions,
  }
}

// --------------------------------------------------------------------- add

async function main() {
  const remove = process.argv.includes("--remove")
  const force = process.argv.includes("--force")

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL!,
    ssl: { rejectUnauthorized: false },
    max: 1,
  })
  const db = drizzle(pool, { schema })

  if (remove) {
    const gone = await removeDemo(db)
    console.log("Demo data removed.")
    console.log(`  ${gone.contacts} contacts`)
    console.log(`  ${gone.enrollments} enrollments (with their payments and attendance)`)
    console.log(`  ${gone.batches} batches, ${gone.sessions} sessions`)
    await pool.end()
    return
  }

  // --------------------------------------------------------------- guards
  const [existingTag] = await db.select().from(tags).where(eq(tags.name, DEMO_TAG))
  if (existingTag && !force) {
    console.error("Demo data is already present.")
    console.error("  npm run db:demo -- --remove    take it out")
    console.error("  npm run db:demo -- --force     rebuild it from scratch")
    await pool.end()
    process.exit(1)
  }
  if (existingTag && force) {
    const gone = await removeDemo(db)
    console.log(`Cleared previous demo data (${gone.contacts} contacts, ${gone.batches} batches).\n`)
  }

  // An owner for created_by. Prefer a superadmin; any user will do.
  const userRows = await db.select({ id: users.id, role: users.role, email: users.email }).from(users)
  if (userRows.length === 0) {
    console.error("No user accounts exist yet. Run `npm run setup:superadmin` first.")
    await pool.end()
    process.exit(1)
  }
  const owner = userRows.find((u) => u.role === "SUPERADMIN") ?? userRows[0]

  // The four programs are the live catalogue — matched by code, never created.
  const programRows = await db.select().from(programs)
  const byCode = (code: string) => programRows.find((p) => p.code === code)
  const MEN_ON = byCode("MENTORSHIP-ONLINE")
  const MEN_OFF = byCode("MENTORSHIP-OFFLINE")
  const TF_ON = byCode("TRADING-FLOOR-ONLINE")
  const TF_OFF = byCode("TRADING-FLOOR-OFFLINE")
  if (!MEN_ON || !MEN_OFF || !TF_ON || !TF_OFF) {
    console.error("The four standard programs were not found. Expected codes:")
    console.error("  MENTORSHIP-ONLINE, MENTORSHIP-OFFLINE, TRADING-FLOOR-ONLINE, TRADING-FLOOR-OFFLINE")
    console.error(`Found: ${programRows.map((p) => p.code).join(", ") || "(none)"}`)
    await pool.end()
    process.exit(1)
  }
  const programOf = { MEN_ON, MEN_OFF, TF_ON, TF_OFF }

  // Refuse to reuse a phone number that already belongs to a live contact.
  // The partial unique index would reject it anyway; failing here says why.
  const wantedPhones = DEMO_CONTACTS.map((c) => `+91${c.phone}`)
  const clashes = await db
    .select({ phone: contacts.phoneE164, name: contacts.fullName })
    .from(contacts)
    .where(and(inArray(contacts.phoneE164, wantedPhones), sql`${contacts.deletedAt} is null`))
  if (clashes.length > 0) {
    console.error("These demo phone numbers already belong to live contacts:")
    for (const c of clashes) console.error(`  ${c.phone}  ${c.name}`)
    await pool.end()
    process.exit(1)
  }

  console.log(`Adding demo data as ${owner.email}\n`)

  // ------------------------------------------------------------ contacts
  const tagId = newId()
  await db.insert(tags).values({ id: tagId, name: DEMO_TAG, colour: "#7c3aed" })

  const contactIds = DEMO_CONTACTS.map(() => newId())
  await db.insert(contacts).values(
    DEMO_CONTACTS.map((c, i) => ({
      id: contactIds[i],
      fullName: c.name,
      phoneE164: `+91${c.phone}`,
      phoneRaw: c.phone,
      email: c.email ?? null,
      city: c.city,
      state: "Maharashtra",
      lifecycleStage: c.stage,
      source: c.source,
      createdBy: owner.id,
    }))
  )
  await db.insert(contactTags).values(contactIds.map((id) => ({ contactId: id, tagId })))
  console.log(`  ${contactIds.length} contacts`)

  // ------------------------------------------------------------- batches
  const batchDefs = {
    MEN_ON_B25: {
      id: newId(),
      programId: MEN_ON.id,
      name: "B25 (Demo)",
      code: `${DEMO_CODE_PREFIX}MEN-ON-B25`,
      startDate: daysAgo(40),
      endDate: daysAhead(50),
      timingText: "Mon/Wed/Fri 7:30–9:00 PM",
      capacity: 40,
      meetingLink: "https://zoom.us/j/98765432101",
      venueName: null,
      venueAddress: null,
      seatCapacity: null,
      status: "RUNNING" as const,
    },
    MEN_ON_B23: {
      id: newId(),
      programId: MEN_ON.id,
      name: "B23 (Demo)",
      code: `${DEMO_CODE_PREFIX}MEN-ON-B23`,
      startDate: daysAgo(220),
      endDate: daysAgo(120),
      timingText: "Tue/Thu 8:00–9:30 PM",
      capacity: 40,
      meetingLink: "https://zoom.us/j/55544433322",
      venueName: null,
      venueAddress: null,
      seatCapacity: null,
      status: "COMPLETED" as const,
    },
    MEN_OFF_B5: {
      id: newId(),
      programId: MEN_OFF.id,
      name: "B5 (Demo)",
      code: `${DEMO_CODE_PREFIX}MEN-OFF-B5`,
      startDate: daysAgo(35),
      endDate: daysAhead(55),
      timingText: "Sat/Sun 10:00 AM–1:00 PM",
      capacity: 24,
      meetingLink: null,
      venueName: "ShubzTrader Kharadi",
      venueAddress: "3rd Floor, World Trade Center, Kharadi, Pune 411014",
      seatCapacity: 24,
      status: "RUNNING" as const,
    },
    TF_ON: {
      id: newId(),
      programId: TF_ON.id,
      name: "Floor Online (Demo)",
      code: `${DEMO_CODE_PREFIX}TF-ON`,
      startDate: daysAgo(180),
      endDate: null,
      timingText: "Weekdays 9:00 AM–3:30 PM",
      capacity: null,
      meetingLink: "https://zoom.us/j/11223344556",
      venueName: null,
      venueAddress: null,
      seatCapacity: null,
      status: "RUNNING" as const,
    },
    TF_OFF: {
      id: newId(),
      programId: TF_OFF.id,
      name: "Kharadi Desks (Demo)",
      code: `${DEMO_CODE_PREFIX}TF-OFF`,
      startDate: daysAgo(200),
      endDate: null,
      timingText: "Weekdays 8:45 AM–4:00 PM",
      capacity: null,
      meetingLink: null,
      venueName: "ShubzTrader Kharadi",
      venueAddress: "3rd Floor, World Trade Center, Kharadi, Pune 411014",
      seatCapacity: 20,
      status: "RUNNING" as const,
    },
  }
  await db.insert(batches).values(Object.values(batchDefs))
  console.log(`  ${Object.keys(batchDefs).length} batches`)

  // ------------------------------------------------------------ sessions
  /**
   * Past sessions are COMPLETED, future ones SCHEDULED. Two past sessions on
   * the running online batch are left deliberately unmarked further down, and
   * one future session is CANCELLED, so both of those states are visible in
   * the UI without anyone having to engineer them by hand.
   */
  type SessionDef = {
    id: string
    batchId: string
    seq: number
    title: string
    scheduledAt: Date
    durationMinutes: number
    status: "SCHEDULED" | "COMPLETED" | "CANCELLED"
    meetingLink: string | null
    roomOrDesk: string | null
  }
  const sessionDefs: SessionDef[] = []

  const MENTORSHIP_TOPICS = [
    "Market structure basics",
    "Break of structure & CHoCH",
    "Order blocks",
    "Liquidity pools",
    "Fair value gaps",
    "Premium & discount arrays",
    "Entry models",
    "Risk & position sizing",
    "Trade journaling",
    "Live market review",
    "Backtesting workshop",
    "Q&A and strategy clinic",
  ]

  /** A weekly run of classes, half behind us and half ahead. */
  function addRun(
    batchId: string,
    opts: {
      count: number
      /** Day offset of the first session; negative is in the past. */
      firstDayOffset: number
      everyDays: number
      hour: number
      minute: number
      online: boolean
      titles: string[]
      room?: string
      link?: string
    }
  ) {
    for (let i = 0; i < opts.count; i++) {
      const dayOffset = opts.firstDayOffset + i * opts.everyDays
      const isPast = dayOffset < 0
      sessionDefs.push({
        id: newId(),
        batchId,
        seq: i + 1,
        title: opts.titles[i % opts.titles.length],
        scheduledAt: istAt(dayOffset, opts.hour, opts.minute),
        durationMinutes: 90,
        status: isPast ? "COMPLETED" : "SCHEDULED",
        meetingLink: opts.online ? (opts.link ?? null) : null,
        roomOrDesk: opts.online ? null : (opts.room ?? "Training Room 1"),
      })
    }
  }

  // Running online batch: 6 held, 4 still to come.
  addRun(batchDefs.MEN_ON_B25.id, {
    count: 10, firstDayOffset: -38, everyDays: 7, hour: 19, minute: 30,
    online: true, titles: MENTORSHIP_TOPICS, link: batchDefs.MEN_ON_B25.meetingLink!,
  })
  // Finished batch: everything in the past.
  addRun(batchDefs.MEN_ON_B23.id, {
    count: 8, firstDayOffset: -215, everyDays: 7, hour: 20, minute: 0,
    online: true, titles: MENTORSHIP_TOPICS, link: batchDefs.MEN_ON_B23.meetingLink!,
  })
  // Offline weekend batch.
  addRun(batchDefs.MEN_OFF_B5.id, {
    count: 8, firstDayOffset: -33, everyDays: 7, hour: 10, minute: 0,
    online: false, titles: MENTORSHIP_TOPICS, room: "Training Room 1",
  })
  // Trading floor runs daily-ish; a short recent run is enough to test the grid.
  addRun(batchDefs.TF_ON.id, {
    count: 6, firstDayOffset: -12, everyDays: 3, hour: 9, minute: 15,
    online: true, titles: ["Pre-market briefing", "Live session", "Post-market review"],
    link: batchDefs.TF_ON.meetingLink!,
  })
  addRun(batchDefs.TF_OFF.id, {
    count: 6, firstDayOffset: -12, everyDays: 3, hour: 8, minute: 45,
    online: false, titles: ["Pre-market briefing", "Live session", "Post-market review"],
    room: "Kharadi Floor",
  })

  // One upcoming session called off, so CANCELLED is represented.
  const futureOnline = sessionDefs.filter(
    (s) => s.batchId === batchDefs.MEN_ON_B25.id && s.status === "SCHEDULED"
  )
  if (futureOnline.length > 1) {
    futureOnline[1].status = "CANCELLED"
    futureOnline[1].title = `${futureOnline[1].title} (called off)`
  }

  await db.insert(classSessions).values(sessionDefs)
  const heldCount = sessionDefs.filter((s) => s.status === "COMPLETED").length
  console.log(`  ${sessionDefs.length} sessions (${heldCount} already held)`)

  // --------------------------------------------------------- enrollments
  // Receipt numbers continue the live sequence for this financial year rather
  // than restarting, so demo receipts never collide with real ones.
  const fy = financialYear()
  const [{ maxSeq }] = await db
    .select({
      maxSeq: sql<number>`coalesce(max(nullif(regexp_replace(${payments.receiptNo}, '^ST-\\d+-', ''), '')::int), 0)`,
    })
    .from(payments)
    .where(like(payments.receiptNo, `ST-${fy}-%`))
  let receiptSeq = Number(maxSeq) || 0

  const PAYMENT_METHODS = ["UPI", "BANK_TRANSFER", "CASH", "CARD", "RAZORPAY"] as const

  const enrollmentRows: (typeof enrollments.$inferInsert)[] = []
  const scheduleRows: (typeof paymentSchedule.$inferInsert)[] = []
  const paymentRows: (typeof payments.$inferInsert)[] = []

  for (const [index, plan] of DEMO_PLANS.entries()) {
    const enrollmentId = newId()
    const startDate = daysAgo(plan.startedDaysAgo)
    const fee = toPaise(plan.feeRupees)
    const discount = toPaise(plan.discountRupees ?? 0)
    const batchId = plan.batch ? batchDefs[plan.batch].id : null

    enrollmentRows.push({
      id: enrollmentId,
      contactId: contactIds[plan.who],
      programId: programOf[plan.program].id,
      batchId,
      status: plan.status ?? "ACTIVE",
      enrolledOn: startDate,
      startDate,
      endDate: null,
      feeTotalPaise: fee,
      discountPaise: discount,
      billingType: plan.recurring ? "RECURRING" : "ONE_TIME",
      billingCycle: plan.recurring ? "MONTHLY" : null,
      seatNumber: plan.seat ?? null,
      source: DEMO_CONTACTS[plan.who].source,
      createdBy: owner.id,
    })

    // The application's own planner, so demo rows are shaped exactly like rows
    // the app creates — same rounding, same due dates, same remainder handling.
    const planned = planSchedule({
      billingType: plan.recurring ? "RECURRING" : "ONE_TIME",
      billingCycle: plan.recurring ? "MONTHLY" : null,
      feeTotalPaise: fee,
      discountPaise: discount,
      startDate,
      installments: plan.installments,
      cycles: plan.recurring ? 12 : undefined,
    })
    for (const row of planned) {
      scheduleRows.push({
        id: newId(),
        enrollmentId,
        seq: row.seq,
        dueDate: row.dueDate,
        amountPaise: row.amountPaise,
        status: "PENDING",
      })
    }

    if (plan.paymentCount > 0 && plan.paidRupees > 0) {
      const totalPaise = toPaise(plan.paidRupees)
      const per = Math.floor(totalPaise / plan.paymentCount)
      let remaining = totalPaise

      for (let i = 0; i < plan.paymentCount; i++) {
        const amount = i === plan.paymentCount - 1 ? remaining : per
        remaining -= amount
        receiptSeq++
        paymentRows.push({
          id: newId(),
          enrollmentId,
          amountPaise: amount,
          paidOn: daysAgo(Math.max(plan.startedDaysAgo - i * 30, 0)),
          method: PAYMENT_METHODS[(index + i) % PAYMENT_METHODS.length],
          referenceNo: `DEMO${String(receiptSeq).padStart(6, "0")}`,
          receiptNo: `ST-${fy}-${String(receiptSeq).padStart(6, "0")}`,
          recordedByUserId: owner.id,
        })
      }
    }
  }

  await db.insert(enrollments).values(enrollmentRows)
  await db.insert(paymentSchedule).values(scheduleRows)
  if (paymentRows.length > 0) await db.insert(payments).values(paymentRows)
  console.log(`  ${enrollmentRows.length} enrollments`)
  console.log(`  ${scheduleRows.length} schedule rows`)
  console.log(`  ${paymentRows.length} payments`)

  // ---------------------------------------------------------- attendance
  /**
   * Marked with a believable spread rather than everyone present, and the two
   * most recent held sessions of the running online batch are skipped on
   * purpose so the "held without a register" warning has something to show.
   */
  const held = sessionDefs.filter((s) => s.status === "COMPLETED")
  const runningOnlineHeld = held
    .filter((s) => s.batchId === batchDefs.MEN_ON_B25.id)
    .sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime())
  const deliberatelyUnmarked = new Set(runningOnlineHeld.slice(0, 2).map((s) => s.id))

  const attendanceRows: (typeof attendance.$inferInsert)[] = []
  for (const session of held) {
    if (deliberatelyUnmarked.has(session.id)) continue
    const roster = enrollmentRows.filter((e) => e.batchId === session.batchId)
    for (const [i, enrollment] of roster.entries()) {
      const roll = (i * 3 + session.seq * 2) % 11
      const status =
        roll === 0 || roll === 7 ? "ABSENT" : roll === 4 ? "LATE" : roll === 9 ? "EXCUSED" : "PRESENT"
      attendanceRows.push({
        id: newId(),
        sessionId: session.id,
        enrollmentId: enrollment.id!,
        status,
        markedByUserId: owner.id,
        source: session.roomOrDesk ? "PHYSICAL_CHECKIN" : "MANUAL",
      })
    }
  }
  if (attendanceRows.length > 0) await db.insert(attendance).values(attendanceRows)
  console.log(`  ${attendanceRows.length} attendance marks (${deliberatelyUnmarked.size} held sessions left unmarked on purpose)`)

  // --------------------------------------------------- notes and consent
  await db.insert(notes).values([
    { id: newId(), contactId: contactIds[2], body: "Asked for an EMI split. Chased on WhatsApp, said he will clear the second instalment after Diwali.", createdBy: owner.id },
    { id: newId(), contactId: contactIds[4], body: "Enrolled but has not paid anything yet. Number rings out — try the alternate number.", createdBy: owner.id },
    { id: newId(), contactId: contactIds[11], body: "Wants to move from the Saturday batch to the online one. Check seat availability in B25.", createdBy: owner.id },
    { id: newId(), contactId: contactIds[24], body: "Watched the YouTube series, asked for the mentorship syllabus. Send the brochure.", createdBy: owner.id },
    { id: newId(), contactId: contactIds[29], body: "Registered for the free webinar. Good candidate for the offline batch — lives in Kharadi.", createdBy: owner.id },
    { id: newId(), contactId: contactIds[35], body: "Stopped attending after the second month. Refund not requested.", createdBy: owner.id },
  ])

  await db.insert(consentEvents).values(
    contactIds.slice(0, 20).map((id) => ({
      id: newId(),
      contactId: id,
      channel: "WHATSAPP" as const,
      action: "OPT_IN" as const,
      consentText: "Agreed to receive class updates and fee reminders on WhatsApp at registration.",
      source: "registration_form",
      recordedBy: owner.id,
    }))
  )
  // One opt-out, so the derived consent view is not uniformly green.
  await db.insert(consentEvents).values({
    id: newId(),
    contactId: contactIds[35],
    channel: "WHATSAPP",
    action: "OPT_OUT",
    consentText: "Asked to be removed from all WhatsApp updates.",
    source: "whatsapp_reply",
    recordedBy: owner.id,
  })
  console.log("  6 notes, 21 consent events")

  // ------------------------------------------------ reconcile, then report
  // Run the real reconciliation so schedule statuses and next_due_date are
  // whatever the application itself would have computed, including OVERDUE.
  const { reconcileSchedule } = await import("../src/server/payments/ledger")
  for (const enrollment of enrollmentRows) {
    await db.transaction(async (tx) => {
      await reconcileSchedule(tx as never, enrollment.id!)
    })
  }
  console.log("  reconciled schedules and next due dates")

  const summary = await db.execute<{
    overdue: number
    outstanding: string
    collected: string
  }>(sql`
    select
      count(*) filter (where is_overdue)::int as overdue,
      coalesce(sum(greatest(balance_due_paise, 0)), 0)::text as outstanding,
      (select coalesce(sum(amount_paise), 0)::text
         from payments where deleted_at is null) as collected
    from enrollment_balances
  `)
  const row = (summary as unknown as { rows: { overdue: number; outstanding: string; collected: string }[] }).rows[0]
  const inr = (paise: string) => `₹${(Number(paise) / 100).toLocaleString("en-IN")}`

  console.log("\nDone. Portal-wide totals now:")
  console.log(`  overdue enrollments : ${row?.overdue ?? 0}`)
  console.log(`  outstanding         : ${inr(row?.outstanding ?? "0")}`)
  console.log(`  collected all time  : ${inr(row?.collected ?? "0")}`)
  console.log("\nRemove it all again with:  npm run db:demo -- --remove")

  await pool.end()
}

main().catch((error) => {
  console.error("\nDemo data failed:")
  console.error(error)
  process.exit(1)
})
