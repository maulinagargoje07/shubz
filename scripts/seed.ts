/**
 * Seed data.
 *
 * The point of this script is not decoration — it is to make the application
 * demonstrably working on first run. In particular the payment dates and due
 * dates are deliberately BACK-DATED so that the overdue list is visibly
 * populated, some enrollments are fully paid, some partly, and the fees
 * dashboard has real numbers in it.
 *
 * Idempotent: re-running deletes the seeded rows and rebuilds them, so it is
 * safe to run repeatedly during development. It refuses to touch a database
 * that already holds non-seed data.
 */

import { config } from "dotenv"

config({ path: ".env", quiet: true })

import { drizzle } from "drizzle-orm/node-postgres"
import { sql } from "drizzle-orm"
import { Pool } from "pg"

import * as schema from "../src/db/schema"
import { planSchedule } from "../src/lib/billing"
import { financialYear } from "../src/lib/fy"
import { newId } from "../src/lib/ids"
import { parsePhone } from "../src/lib/phone"
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
  accounts,
} = schema

/** "yyyy-MM-dd" for a date N days from today. */
function daysAgo(n: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

function daysAhead(n: number): string {
  return daysAgo(-n)
}

/** An instant N days from now, at a given IST hour. */
function istAt(daysFromNow: number, hour: number, minute = 0): Date {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + daysFromNow)
  const ymd = d.toISOString().slice(0, 10)
  return new Date(`${ymd}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+05:30`)
}

const INDIAN_CONTACTS: {
  name: string
  phone: string
  city: string
  state: string
  email?: string
}[] = [
  { name: "Aarav Deshpande", phone: "9822011001", city: "Pune", state: "Maharashtra", email: "aarav.deshpande@example.in" },
  { name: "Ananya Kulkarni", phone: "9822011002", city: "Pune", state: "Maharashtra", email: "ananya.k@example.in" },
  { name: "Rohan Joshi", phone: "9822011003", city: "Pune", state: "Maharashtra" },
  { name: "Priya Sharma", phone: "9811022004", city: "Delhi", state: "Delhi", email: "priya.sharma@example.in" },
  { name: "Vikram Patil", phone: "9822011005", city: "Pune", state: "Maharashtra" },
  { name: "Sneha Iyer", phone: "9840033006", city: "Chennai", state: "Tamil Nadu", email: "sneha.iyer@example.in" },
  { name: "Karthik Reddy", phone: "9848044007", city: "Hyderabad", state: "Telangana" },
  { name: "Meera Nair", phone: "9847055008", city: "Kochi", state: "Kerala", email: "meera.nair@example.in" },
  { name: "Siddharth Rao", phone: "9822011009", city: "Pune", state: "Maharashtra" },
  { name: "Neha Gupta", phone: "9811022010", city: "Noida", state: "Uttar Pradesh" },
  { name: "Arjun Mehta", phone: "9820066011", city: "Mumbai", state: "Maharashtra", email: "arjun.mehta@example.in" },
  { name: "Pooja Bhosale", phone: "9822011012", city: "Pune", state: "Maharashtra" },
  { name: "Rahul Chavan", phone: "9822011013", city: "Pune", state: "Maharashtra" },
  { name: "Divya Menon", phone: "9847055014", city: "Thrissur", state: "Kerala" },
  { name: "Aditya Kale", phone: "9822011015", city: "Pune", state: "Maharashtra", email: "aditya.kale@example.in" },
  { name: "Ishita Banerjee", phone: "9830077016", city: "Kolkata", state: "West Bengal" },
  { name: "Nikhil Shetty", phone: "9845088017", city: "Bengaluru", state: "Karnataka" },
  { name: "Tanvi Jadhav", phone: "9822011018", city: "Pune", state: "Maharashtra" },
  { name: "Manish Agarwal", phone: "9829099019", city: "Jaipur", state: "Rajasthan" },
  { name: "Shruti Pawar", phone: "9822011020", city: "Pune", state: "Maharashtra", email: "shruti.pawar@example.in" },
  { name: "Harsh Vardhan", phone: "9811022021", city: "Gurugram", state: "Haryana" },
  { name: "Kavya Krishnan", phone: "9840033022", city: "Coimbatore", state: "Tamil Nadu" },
  { name: "Om Sathe", phone: "9822011023", city: "Pune", state: "Maharashtra" },
  { name: "Riya Malhotra", phone: "9811022024", city: "Delhi", state: "Delhi" },
  { name: "Sanjay Gaikwad", phone: "9822011025", city: "Pune", state: "Maharashtra" },
]

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and paste your Railway connection string."
    )
  }

  const pool = new Pool({
    connectionString: url,
    ssl: url.includes(".railway.internal") ? undefined : { rejectUnauthorized: false },
    max: 1,
  })
  const db = drizzle(pool, { schema })

  console.log("Seeding ShubzTrader…\n")

  // ---------------------------------------------------------------- reset
  // Truncate rather than delete: FK-safe in one statement, and it makes the
  // script genuinely re-runnable.
  await db.execute(sql`
    truncate table
      attendance, payment_schedule, payments, enrollments,
      sessions, batches, programs,
      contact_tags, consent_events, notes, contacts, tags,
      import_rows, imports, audit_log,
      campaign_recipients, campaigns, message_events, messages,
      message_templates, webhook_events, scheduled_jobs
    restart identity cascade
  `)
  console.log("  cleared existing data")

  // ------------------------------------------------------------ admin user
  //
  // The ROOT account is not created here. `npm run setup:superadmin` owns it,
  // is idempotent, and touches only the auth tables — so it can be re-run
  // against production without going anywhere near business data. This seed
  // only ensures *some* user exists to attribute demo rows to.
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@shubztrader.in"
  const adminName = process.env.SEED_ADMIN_NAME ?? "Shubz Admin"
  const adminPassword = process.env.SEED_ADMIN_PASSWORD

  const [existingAdmin] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`${users.email} = ${adminEmail}`)
    .limit(1)

  let adminId: string

  if (existingAdmin) {
    adminId = existingAdmin.id
    console.log(`  admin already exists: ${adminEmail}`)
  } else if (!adminPassword) {
    // Create the row so foreign keys resolve, but without a credential — the
    // password must be set through Better Auth so it is hashed correctly.
    adminId = newId()
    await db.insert(users).values({
      id: adminId,
      name: adminName,
      email: adminEmail,
      emailVerified: true,
      role: "ADMIN",
      active: true,
    })
    console.log(`  admin created WITHOUT a password: ${adminEmail}`)
    console.log("    set SEED_ADMIN_PASSWORD and re-run to enable sign-in")
  } else {
    // Hash through Better Auth's own scrypt so the credential verifies.
    const { auth } = await import("../src/lib/auth")
    const ctx = await auth.$context
    const hash = await ctx.password.hash(adminPassword)

    adminId = newId()
    await db.insert(users).values({
      id: adminId,
      name: adminName,
      email: adminEmail,
      emailVerified: true,
      role: "ADMIN",
      active: true,
    })
    await db.insert(accounts).values({
      id: newId(),
      userId: adminId,
      accountId: adminId,
      providerId: "credential",
      issuer: "local:credential",
      password: hash,
    })
    console.log(`  admin created: ${adminEmail}`)
  }

  // -------------------------------------------------------------- programs
  // One per combination of type and delivery mode that the business runs.
  const programRows = [
    {
      id: newId(),
      name: "SMC Mentorship",
      code: "SMC-ONLINE",
      type: "MENTORSHIP" as const,
      deliveryMode: "ONLINE" as const,
      description: "Smart Money Concepts mentorship, delivered live online.",
      defaultFeePaise: toPaise(45000),
      defaultDurationDays: 90,
      defaultBillingType: "ONE_TIME" as const,
      defaultBillingCycle: null,
      status: "ACTIVE" as const,
    },
    {
      id: newId(),
      name: "SMC Mentorship Pune",
      code: "SMC-PUNE",
      type: "MENTORSHIP" as const,
      deliveryMode: "OFFLINE" as const,
      description: "Smart Money Concepts mentorship, in person at Kharadi.",
      defaultFeePaise: toPaise(55000),
      defaultDurationDays: 90,
      defaultBillingType: "ONE_TIME" as const,
      defaultBillingCycle: null,
      status: "ACTIVE" as const,
    },
    {
      id: newId(),
      name: "Trading Floor Live",
      code: "TF-ONLINE",
      type: "TRADING_FLOOR" as const,
      deliveryMode: "ONLINE" as const,
      description: "Daily online trading floor membership.",
      defaultFeePaise: toPaise(5000),
      defaultDurationDays: null,
      defaultBillingType: "RECURRING" as const,
      defaultBillingCycle: "MONTHLY" as const,
      status: "ACTIVE" as const,
    },
    {
      id: newId(),
      name: "Trading Floor Kharadi",
      code: "TF-KHARADI",
      type: "TRADING_FLOOR" as const,
      deliveryMode: "OFFLINE" as const,
      description: "Desk at the Kharadi trading floor.",
      defaultFeePaise: toPaise(8000),
      defaultDurationDays: null,
      defaultBillingType: "RECURRING" as const,
      defaultBillingCycle: "MONTHLY" as const,
      status: "ACTIVE" as const,
    },
  ]

  await db.insert(programs).values(programRows.map((p) => ({ ...p, createdBy: adminId })))
  const [smcOnline, smcPune, tfOnline, tfKharadi] = programRows
  console.log(`  ${programRows.length} programs`)

  // --------------------------------------------------------------- batches
  const batchRows = [
    {
      id: newId(),
      programId: smcOnline.id,
      name: "SMC Online — Batch 7",
      code: "SMC-ON-B7",
      startDate: daysAgo(45),
      endDate: daysAhead(45),
      timingText: "Mon/Wed/Fri 7:30–9:00 PM",
      capacity: 40,
      // ONLINE -> meeting link, no venue.
      meetingLink: "https://zoom.us/j/98765432101",
      venueName: null,
      venueAddress: null,
      seatCapacity: null,
      status: "RUNNING" as const,
    },
    {
      id: newId(),
      programId: smcPune.id,
      name: "SMC Pune — Batch 3",
      code: "SMC-PN-B3",
      startDate: daysAgo(30),
      endDate: daysAhead(60),
      timingText: "Sat/Sun 10:00 AM–1:00 PM",
      capacity: 24,
      // OFFLINE -> venue, no meeting link.
      meetingLink: null,
      venueName: "ShubzTrader Kharadi",
      venueAddress: "3rd Floor, World Trade Center, Kharadi, Pune 411014",
      seatCapacity: 24,
      status: "RUNNING" as const,
    },
    {
      id: newId(),
      programId: tfOnline.id,
      name: "Trading Floor Online",
      code: "TF-ON-2026",
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
    {
      id: newId(),
      programId: tfKharadi.id,
      name: "Kharadi Floor — Desks",
      code: "TF-KH-2026",
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
  ]

  await db.insert(batches).values(batchRows)
  const [smcOnlineBatch, smcPuneBatch, tfOnlineBatch, tfKharadiBatch] = batchRows
  console.log(`  ${batchRows.length} batches`)

  // -------------------------------------------------------------- sessions
  // A mix of completed and upcoming, so attendance and the "next 7 days"
  // dashboard tile both have something real to show.
  const sessionRows = [
    { batchId: smcOnlineBatch.id, seq: 1, title: "Market structure basics", days: -20, hour: 19, minute: 30, status: "COMPLETED" as const },
    { batchId: smcOnlineBatch.id, seq: 2, title: "Order blocks and liquidity", days: -13, hour: 19, minute: 30, status: "COMPLETED" as const },
    { batchId: smcOnlineBatch.id, seq: 3, title: "Fair value gaps", days: -6, hour: 19, minute: 30, status: "COMPLETED" as const },
    { batchId: smcOnlineBatch.id, seq: 4, title: "Entry models", days: 2, hour: 19, minute: 30, status: "SCHEDULED" as const },
    { batchId: smcOnlineBatch.id, seq: 5, title: "Risk and position sizing", days: 5, hour: 19, minute: 30, status: "SCHEDULED" as const },
    { batchId: smcPuneBatch.id, seq: 1, title: "Floor induction", days: -21, hour: 10, minute: 0, status: "COMPLETED" as const },
    { batchId: smcPuneBatch.id, seq: 2, title: "Live market walkthrough", days: -14, hour: 10, minute: 0, status: "COMPLETED" as const },
    { batchId: smcPuneBatch.id, seq: 3, title: "Journaling workshop", days: -7, hour: 10, minute: 0, status: "COMPLETED" as const },
    { batchId: smcPuneBatch.id, seq: 4, title: "Backtesting clinic", days: 3, hour: 10, minute: 0, status: "SCHEDULED" as const },
    { batchId: tfKharadiBatch.id, seq: 1, title: "Monthly floor review", days: 6, hour: 16, minute: 0, status: "SCHEDULED" as const },
  ]

  const sessionIds = sessionRows.map(() => newId())
  await db.insert(classSessions).values(
    sessionRows.map((s, i) => ({
      id: sessionIds[i],
      batchId: s.batchId,
      seq: s.seq,
      title: s.title,
      scheduledAt: istAt(s.days, s.hour, s.minute),
      durationMinutes: 90,
      status: s.status,
    }))
  )
  console.log(`  ${sessionRows.length} sessions`)

  // -------------------------------------------------------------- contacts
  const contactIds = INDIAN_CONTACTS.map(() => newId())
  await db.insert(contacts).values(
    INDIAN_CONTACTS.map((c, i) => {
      const parsed = parsePhone(c.phone)
      // First 18 become students (they get enrollments below); the rest are
      // leads and registrants, which is roughly the real funnel shape.
      const stage = i < 18 ? "STUDENT" : i < 22 ? "REGISTERED" : "LEAD"
      const sources = ["YOUTUBE", "INSTAGRAM", "REFERRAL", "WEBSITE", "WALK_IN", "TELEGRAM"] as const
      return {
        id: contactIds[i],
        fullName: c.name,
        phoneE164: parsed.e164,
        phoneRaw: c.phone,
        email: c.email ?? null,
        city: c.city,
        state: c.state,
        lifecycleStage: stage as "STUDENT" | "REGISTERED" | "LEAD",
        source: sources[i % sources.length],
        createdBy: adminId,
      }
    })
  )
  console.log(`  ${INDIAN_CONTACTS.length} contacts`)

  // ------------------------------------------------------------------ tags
  const tagRows = [
    { id: newId(), name: "High intent", colour: "#059669" },
    { id: newId(), name: "Needs follow-up", colour: "#d97706" },
    { id: newId(), name: "Referred", colour: "#7c3aed" },
  ]
  await db.insert(tags).values(tagRows)
  await db.insert(contactTags).values([
    { contactId: contactIds[0], tagId: tagRows[0].id },
    { contactId: contactIds[3], tagId: tagRows[1].id },
    { contactId: contactIds[7], tagId: tagRows[2].id },
    { contactId: contactIds[22], tagId: tagRows[1].id },
  ])

  await db.insert(consentEvents).values(
    contactIds.slice(0, 10).map((id) => ({
      id: newId(),
      contactId: id,
      channel: "WHATSAPP" as const,
      action: "OPT_IN" as const,
      consentText: "Agreed to receive class updates on WhatsApp at registration.",
      source: "registration_form",
      recordedBy: adminId,
    }))
  )

  await db.insert(notes).values([
    {
      id: newId(),
      contactId: contactIds[3],
      body: "Asked about EMI options. Follow up after the next webinar.",
      createdBy: adminId,
    },
    {
      id: newId(),
      contactId: contactIds[22],
      body: "Walked in at Kharadi, wants to try the floor for a month.",
      createdBy: adminId,
    },
  ])

  // ----------------------------------------------------------- enrollments
  /**
   * 18 enrollments spread across all four programs, with deliberately varied
   * payment histories so the fees dashboard and overdue list are populated:
   *
   *   paidCycles / paidAmount drives whether an enrollment ends up fully paid,
   *   partly paid, or overdue. Start dates are pushed into the past so that
   *   due dates have genuinely passed.
   */
  type Plan = {
    contactIndex: number
    program: (typeof programRows)[number]
    batchId: string | null
    startedDaysAgo: number
    installments: number
    /** How much has actually been paid, in rupees. */
    paidRupees: number
    /** Split the payment across this many receipts. */
    paymentCount: number
    seat?: string
    discountRupees?: number
  }

  const plans: Plan[] = [
    // SMC Mentorship (Online) — one-time, 3 installments
    { contactIndex: 0, program: smcOnline, batchId: smcOnlineBatch.id, startedDaysAgo: 45, installments: 3, paidRupees: 45000, paymentCount: 3 },
    { contactIndex: 1, program: smcOnline, batchId: smcOnlineBatch.id, startedDaysAgo: 45, installments: 3, paidRupees: 30000, paymentCount: 2 },
    // Overdue: two instalments have come due, only one paid.
    { contactIndex: 2, program: smcOnline, batchId: smcOnlineBatch.id, startedDaysAgo: 75, installments: 3, paidRupees: 15000, paymentCount: 1 },
    { contactIndex: 3, program: smcOnline, batchId: smcOnlineBatch.id, startedDaysAgo: 45, installments: 1, paidRupees: 45000, paymentCount: 1 },
    { contactIndex: 4, program: smcOnline, batchId: smcOnlineBatch.id, startedDaysAgo: 100, installments: 3, paidRupees: 0, paymentCount: 0 },

    // SMC Mentorship Pune (Offline) — one-time, with discounts and seats
    { contactIndex: 5, program: smcPune, batchId: smcPuneBatch.id, startedDaysAgo: 30, installments: 3, paidRupees: 50000, paymentCount: 3, seat: "D-01", discountRupees: 5000 },
    { contactIndex: 6, program: smcPune, batchId: smcPuneBatch.id, startedDaysAgo: 30, installments: 3, paidRupees: 20000, paymentCount: 2, seat: "D-02" },
    { contactIndex: 7, program: smcPune, batchId: smcPuneBatch.id, startedDaysAgo: 90, installments: 3, paidRupees: 18333, paymentCount: 1, seat: "D-03" },
    { contactIndex: 8, program: smcPune, batchId: smcPuneBatch.id, startedDaysAgo: 30, installments: 1, paidRupees: 55000, paymentCount: 1, seat: "D-04" },

    // Trading Floor Live (Online) — recurring monthly, no batch for some
    { contactIndex: 9, program: tfOnline, batchId: tfOnlineBatch.id, startedDaysAgo: 150, installments: 1, paidRupees: 25000, paymentCount: 5 },
    { contactIndex: 10, program: tfOnline, batchId: tfOnlineBatch.id, startedDaysAgo: 120, installments: 1, paidRupees: 20000, paymentCount: 4 },
    // Overdue: three months elapsed, one paid.
    { contactIndex: 11, program: tfOnline, batchId: tfOnlineBatch.id, startedDaysAgo: 100, installments: 1, paidRupees: 5000, paymentCount: 1 },
    // A batchless membership, which the schema explicitly allows.
    { contactIndex: 12, program: tfOnline, batchId: null, startedDaysAgo: 60, installments: 1, paidRupees: 10000, paymentCount: 2 },

    // Trading Floor Kharadi (Offline) — recurring monthly with desks
    { contactIndex: 13, program: tfKharadi, batchId: tfKharadiBatch.id, startedDaysAgo: 150, installments: 1, paidRupees: 40000, paymentCount: 5, seat: "K-01" },
    { contactIndex: 14, program: tfKharadi, batchId: tfKharadiBatch.id, startedDaysAgo: 120, installments: 1, paidRupees: 24000, paymentCount: 3, seat: "K-02" },
    // Overdue: four months elapsed, two paid.
    { contactIndex: 15, program: tfKharadi, batchId: tfKharadiBatch.id, startedDaysAgo: 130, installments: 1, paidRupees: 16000, paymentCount: 2, seat: "K-03" },
    { contactIndex: 16, program: tfKharadi, batchId: tfKharadiBatch.id, startedDaysAgo: 90, installments: 1, paidRupees: 24000, paymentCount: 3, seat: "K-04" },
    // Overdue and never paid.
    { contactIndex: 17, program: tfKharadi, batchId: tfKharadiBatch.id, startedDaysAgo: 75, installments: 1, paidRupees: 0, paymentCount: 0, seat: "K-05" },
  ]

  let receiptSeq = 0
  const fy = financialYear()
  const paymentMethods = ["UPI", "BANK_TRANSFER", "CASH", "CARD", "RAZORPAY"] as const

  const enrollmentRows: (typeof enrollments.$inferInsert)[] = []
  const scheduleRows: (typeof paymentSchedule.$inferInsert)[] = []
  const paymentRows: (typeof payments.$inferInsert)[] = []

  for (const [index, plan] of plans.entries()) {
    const enrollmentId = newId()
    const startDate = daysAgo(plan.startedDaysAgo)
    const fee = plan.program.defaultFeePaise
    const discount = toPaise(plan.discountRupees ?? 0)
    const isRecurring = plan.program.defaultBillingType === "RECURRING"

    enrollmentRows.push({
      id: enrollmentId,
      contactId: contactIds[plan.contactIndex],
      programId: plan.program.id,
      batchId: plan.batchId,
      status: "ACTIVE",
      enrolledOn: startDate,
      startDate,
      endDate: null,
      feeTotalPaise: fee,
      discountPaise: discount,
      billingType: plan.program.defaultBillingType,
      billingCycle: plan.program.defaultBillingCycle,
      seatNumber: plan.seat ?? null,
      source: "REFERRAL",
      createdBy: adminId,
    })

    // The same planner the application uses, so seeded data is shaped exactly
    // like data the app would create.
    const planned = planSchedule({
      billingType: plan.program.defaultBillingType,
      billingCycle: plan.program.defaultBillingCycle,
      feeTotalPaise: fee,
      discountPaise: discount,
      startDate,
      installments: plan.installments,
      cycles: isRecurring ? 12 : undefined,
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

    // Payments, dated backwards from the start date so they look like a real
    // history rather than everything landing today.
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
          method: paymentMethods[(index + i) % paymentMethods.length],
          referenceNo: `SEED${String(receiptSeq).padStart(6, "0")}`,
          receiptNo: `ST-${fy}-${String(receiptSeq).padStart(6, "0")}`,
          recordedByUserId: adminId,
        })
      }
    }
  }

  await db.insert(enrollments).values(enrollmentRows)
  await db.insert(paymentSchedule).values(scheduleRows)
  await db.insert(payments).values(paymentRows)
  console.log(`  ${enrollmentRows.length} enrollments`)
  console.log(`  ${scheduleRows.length} schedule rows`)
  console.log(`  ${paymentRows.length} payments`)

  // ------------------------------------------------------------ attendance
  // Mark the completed sessions so the attendance percentage is meaningful.
  const completedSessions = sessionRows
    .map((s, i) => ({ ...s, id: sessionIds[i] }))
    .filter((s) => s.status === "COMPLETED")

  const attendanceRows: (typeof attendance.$inferInsert)[] = []

  for (const session of completedSessions) {
    const roster = enrollmentRows.filter((e) => e.batchId === session.batchId)
    for (const [i, enrollment] of roster.entries()) {
      // A realistic spread rather than everyone present: roughly one in five
      // absent, with the occasional late and excused.
      const roll = (i + session.seq) % 6
      const status =
        roll === 0 ? "ABSENT" : roll === 3 ? "LATE" : roll === 5 ? "EXCUSED" : "PRESENT"

      attendanceRows.push({
        id: newId(),
        sessionId: session.id,
        enrollmentId: enrollment.id!,
        status,
        markedByUserId: adminId,
        source: session.batchId === smcPuneBatch.id ? "PHYSICAL_CHECKIN" : "MANUAL",
      })
    }
  }

  if (attendanceRows.length > 0) {
    await db.insert(attendance).values(attendanceRows)
  }
  console.log(`  ${attendanceRows.length} attendance rows`)

  // -------------------------------------------- derive schedule + due dates
  // Run the real reconciliation so statuses and next_due_date match exactly
  // what the app would compute — including which rows are now OVERDUE.
  const { reconcileSchedule } = await import("../src/server/payments/ledger")

  for (const enrollment of enrollmentRows) {
    await db.transaction(async (tx) => {
      await reconcileSchedule(tx as never, enrollment.id!)
    })
  }
  console.log("  reconciled schedules and next due dates")

  // ------------------------------------------------------------------ echo
  const [summary] = await db.execute<{
    overdue: number
    outstanding: string
    collected: string
  }>(sql`
    select
      count(*) filter (where is_overdue)::int as overdue,
      coalesce(sum(greatest(balance_due_paise, 0)), 0)::text as outstanding,
      (select coalesce(sum(amount_paise), 0)::text from payments where deleted_at is null) as collected
    from enrollment_balances
  `).then((r) => (r as unknown as { rows: { overdue: number; outstanding: string; collected: string }[] }).rows)

  console.log("\nSeed complete.")
  console.log(`  overdue enrollments : ${summary?.overdue ?? 0}`)
  console.log(`  outstanding         : ₹${(Number(summary?.outstanding ?? 0) / 100).toLocaleString("en-IN")}`)
  console.log(`  collected all time  : ₹${(Number(summary?.collected ?? 0) / 100).toLocaleString("en-IN")}`)
  if (adminPassword) {
    console.log(`\n  sign in as ${adminEmail}`)
  }

  await pool.end()
}

main().catch((error) => {
  console.error("\nSeed failed:")
  console.error(error)
  process.exit(1)
})
