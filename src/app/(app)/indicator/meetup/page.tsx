import { CalendarDays, CircleAlert, ExternalLink, IndianRupee, MapPin, Ticket, Users } from "lucide-react"

import { CitySplit, ExperienceSplit, RegistrationCalendar, RegistrationsByDay } from "@/components/indicator/meetup-charts"
import { MeetupBackfillButton } from "@/components/indicator/meetup-backfill"
import { MeetupGrid } from "@/components/indicator/meetup-grid"
import { IndicatorToolbar } from "@/components/indicator/toolbar"
import { IndicatorUnavailable } from "@/components/indicator/unavailable"
import { PageHeader, SectionHeading } from "@/components/page-header"
import { StatTile } from "@/components/ui/status"
import { formatDate, formatIST } from "@/lib/fy"
import {
  EXPERIENCE_LABELS,
  EXPERIENCE_LEVELS,
  type ExperienceLevel,
  MEETUP_STATUS_FILTERS,
  type MeetupPayload,
  type MeetupRegistration,
} from "@/lib/indicator"
import { formatINR, formatINRShort } from "@/lib/money"
import type { RawParam } from "@/lib/search-params"
import { requirePermissionPage } from "@/lib/session"
import { fetchAll, getMeetup, PaymentsApiError } from "@/server/indicator/api"
import { fromRecord, hrefWith, meetupFilters } from "@/server/indicator/filters"

export const dynamic = "force-dynamic"
export const metadata = { title: "Meetup" }

const PATH = "/indicator/meetup"

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/**
 * The Pune Forex Traders Meetup: who has registered and paid on the Razorpay
 * Payment Page. Every figure is the payments service's (it hears about each
 * payment from Razorpay's webhooks); this page lays them out, refreshing
 * itself every 10 seconds like the other Indicator pages.
 */
export default async function MeetupPage({ searchParams }: { searchParams: Promise<Record<string, RawParam>> }) {
  const user = await requirePermissionPage("VIEW_INDICATOR")
  const params = await searchParams
  const filters = meetupFilters(fromRecord(params))

  let rows: MeetupRegistration[]
  let data: MeetupPayload
  try {
    const all = await fetchAll((page) => getMeetup({ mode: filters.mode, ...page }))
    rows = all.rows
    data = all.meta
  } catch (error) {
    if (!(error instanceof PaymentsApiError)) throw error
    return (
      <div className="pb-8">
        <PageHeader title="Meetup" description="Pune Forex Traders Meetup registrations." />
        {error.kind === "not_found" ? (
          <div className="px-4 pt-4 sm:px-6">
            <p className="glass-tint flex items-start gap-2.5 rounded-2xl border-pending/40 bg-pending-muted px-4 py-3 text-sm text-pending-foreground">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>The payments service needs updating before meetup registrations can show here.</span>
            </p>
          </div>
        ) : (
          <IndicatorUnavailable error={error} />
        )}
      </div>
    )
  }

  const mode = data.mode === data.serviceMode ? undefined : data.mode
  const link = (extra: Record<string, string | undefined> = {}) => hrefWith(PATH, { ...extra, mode })
  const { event, totals } = data

  // Links arrive as ?status=failed or ?experience=beginner; they become the grid's starting filters.
  const initialFilters = {
    status: filters.status ? [label(MEETUP_STATUS_FILTERS, filters.status)] : undefined,
    experience: filters.experience ? [EXPERIENCE_LABELS[filters.experience]] : undefined,
  }

  const known = EXPERIENCE_LEVELS.map((level) => totals.byExperience[level])
  // Plain strings, not a function: props cross into a client component.
  const experienceHrefs = Object.fromEntries(EXPERIENCE_LEVELS.map((level) => [level, link({ experience: level })])) as Record<ExperienceLevel, string>
  const topLevel = EXPERIENCE_LEVELS.reduce((best, level) => (totals.byExperience[level] > totals.byExperience[best] ? level : best), EXPERIENCE_LEVELS[0])

  return (
    <div className="pb-8">
      <PageHeader
        title="Meetup"
        description={`${event.name} · ${formatDate(event.date, "EEEE d MMMM yyyy")} · ${event.venue} · ${formatINRShort(event.ticketPaise)} a ticket`}
        actions={user.role === "SUPERADMIN" && data.pageId ? <MeetupBackfillButton mode={data.mode} /> : undefined}
      />
      <IndicatorToolbar path={PATH} mode={data.mode} serviceMode={data.serviceMode} generatedAt={data.generatedAt} />

      {data.report.state !== "ready" ? (
        <div className="px-4 pt-4 sm:px-6">
          <p role="status" className="glass-tint flex items-start gap-2.5 rounded-2xl border-pending/40 bg-pending-muted px-4 py-3 text-sm text-pending-foreground">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {data.report.state === "invalid"
                ? data.report.problem
                : `The payments service has no Payment Page for ${data.mode} mode yet: set ${data.report.variable} on shubztrader-payments in Railway to the page's ID (it starts with pl_).`}{" "}
              Until then, payments on the meetup page in this mode aren&apos;t recorded.
            </span>
          </p>
        </div>
      ) : null}

      {/* ---------------------------------------------------- Headline figures */}
      <section className="px-4 pt-5 sm:px-6">
        <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Amount collected"
            value={formatINRShort(totals.collectedPaise)}
            icon={<IndianRupee className="size-4" />}
            hint={`${plural(totals.registrations, "ticket")} at ${formatINRShort(event.ticketPaise)}`}
            trend={totals.byDay.map((d) => d.collectedPaise)}
            href={link({ status: "captured" })}
          />
          <StatTile
            label="Registrations"
            value={totals.registrations}
            tone={totals.registrations > 0 ? "paid" : undefined}
            icon={<Ticket className="size-4" />}
            hint={`${plural(totals.registrationsToday, "today", "today")} · ${totals.registrationsLast7Days} in the last 7 days`}
            trend={totals.byDay.map((d) => d.registrations)}
            trendColor="var(--chart-2)"
            href={link({ status: "captured" })}
          />
          <StatTile
            label="Failed attempts"
            value={totals.failedAttempts}
            tone={totals.unrecoveredFailures > 0 ? "overdue" : undefined}
            icon={<CircleAlert className="size-4" />}
            hint={
              totals.failedAttempts === 0
                ? "No declined payments"
                : totals.unrecoveredFailures > 0
                  ? `${plural(totals.unrecoveredFailures, "person", "people")} never paid afterwards: worth a WhatsApp`
                  : "Everyone who failed has since paid"
            }
            href={link({ status: "failed" })}
          />
          <StatTile
            label="By experience"
            value={
              totals.registrations === 0 ? (
                "—"
              ) : (
                <span className="flex flex-wrap items-baseline gap-x-3">
                  {EXPERIENCE_LEVELS.map((level) => (
                    <span key={level} className="inline-flex items-baseline gap-1">
                      <span className="tabular-nums">{totals.byExperience[level]}</span>
                      <span className="text-[0.625rem] font-semibold uppercase tracking-wider text-muted-foreground">{EXPERIENCE_LABELS[level].slice(0, 3)}</span>
                    </span>
                  ))}
                </span>
              )
            }
            icon={<Users className="size-4" />}
            hint={
              totals.registrations === 0
                ? "Beginner · Intermediate · Advanced"
                : `Mostly ${EXPERIENCE_LABELS[topLevel].toLowerCase()}${
                    totals.byExperience.unknown ? ` · ${totals.byExperience.unknown} gave something else` : ""
                  }`
            }
            href={known.some((n) => n > 0) ? link({ experience: topLevel }) : undefined}
          />
        </div>
      </section>

      {/* ------------------------------------------------------------- Charts */}
      <section className="px-4 pt-7 sm:px-6">
        <SectionHeading>Registrations</SectionHeading>
        <div className="stagger grid grid-cols-1 gap-4 lg:grid-cols-3">
          <RegistrationsByDay totals={totals} />
          <ExperienceSplit totals={totals} hrefs={experienceHrefs} />
          <RegistrationCalendar totals={totals} />
          <CitySplit totals={totals} />
          <EventCard data={data} />
        </div>
      </section>

      {/* ------------------------------------------------------------- Grid */}
      <section className="pt-7">
        <div className="px-4 sm:px-6">
          <SectionHeading>Everyone who registered</SectionHeading>
          <p className="-mt-1.5 mb-3 text-sm text-muted-foreground">
            One row per payment on the Razorpay page, newest first: paid tickets and declined attempts. Click a heading to sort; the funnel filters that column; the download is exactly what&apos;s on screen.
          </p>
        </div>
        <MeetupGrid key={JSON.stringify(params)} rows={rows} initialFilters={initialFilters} initialSearch={filters.q} />
      </section>
    </div>
  )
}

/** The event's facts and where the registrations come from, as the payments service states them. */
function EventCard({ data }: { data: MeetupPayload }) {
  const { event } = data
  const row = "flex items-start gap-2.5 text-sm"
  return (
    <section className="glass flex flex-col rounded-3xl p-5" data-chart="Event">
      <header className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">{event.name}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Speaker: {event.speaker}</p>
      </header>
      <dl className="space-y-3">
        <div className={row}>
          <CalendarDays className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <div>
            <dt className="sr-only">When</dt>
            <dd className="font-medium text-foreground">{formatDate(event.date, "EEEE d MMMM yyyy")}</dd>
            <dd className="text-xs text-muted-foreground">{event.timeLabel}</dd>
          </div>
        </div>
        <div className={row}>
          <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <div>
            <dt className="sr-only">Where</dt>
            <dd className="font-medium text-foreground">{event.venue}</dd>
            <dd className="text-xs text-muted-foreground">{event.address}</dd>
            <dd>
              <a href={event.mapUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80">
                Open in Google Maps <ExternalLink className="size-3" aria-hidden />
              </a>
            </dd>
          </div>
        </div>
        <div className={row}>
          <Ticket className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <div>
            <dt className="sr-only">Ticket</dt>
            <dd className="font-medium text-foreground">{formatINR(event.ticketPaise, { paise: false })} a ticket</dd>
            <dd className="text-xs text-muted-foreground">{event.refundPolicy} No seat cap, no deadline.</dd>
            <dd>
              <a href={event.registerUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80">
                Registration page <ExternalLink className="size-3" aria-hidden />
              </a>
            </dd>
          </div>
        </div>
      </dl>
      <p className="mt-4 border-t border-border/50 pt-3 text-xs text-muted-foreground">
        {data.pageId ? (
          <>
            Listening for payments on page <span className="font-mono text-foreground/90">{data.pageId}</span> ({data.mode}).
          </>
        ) : (
          <>No Payment Page set for {data.mode} mode.</>
        )}
        {data.totals.latestRegistrationAt ? <> Latest registration {formatIST(data.totals.latestRegistrationAt, "d MMM, h:mm a")}.</> : null}
      </p>
    </section>
  )
}

function label(options: readonly { value: string; label: string }[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? value
}
