"use client"

import { useState } from "react"
import { format } from "date-fns"

import { AreaChart, type AreaPoint } from "@/components/charts/area-chart"
import { CalendarHeatmap, type HeatmapDay } from "@/components/charts/calendar-heatmap"
import { ChartCard, Segmented } from "@/components/charts/chart-card"
import { DonutChart } from "@/components/charts/donut-chart"
import { formatValue, SERIES } from "@/components/charts/palette"
import { RankedBars } from "@/components/charts/ranked-bars"
import type { Part } from "@/components/charts/segmented-bar"
import { EXPERIENCE_LABELS, type ExperienceLevel, type MeetupTotals } from "@/lib/indicator"

/*
 * The meetup's charts, drawn from the day-by-day series and splits the
 * payments service sends (nothing is counted here):
 *
 *   Registrations by day   an area chart of the days since the first ticket
 *                          (at least the last 30), switchable between tickets
 *                          and money, with failed attempts as a second line
 *   Calendar               one square per day, the way GitHub draws it, so a
 *                          busy week after a WhatsApp push is easy to see
 *   Experience             a ring: beginners, intermediate, advanced
 *   Cities                 ranked bars, most registrations first
 */

type Measure = "registrations" | "collected"

const MEASURES: { value: Measure; label: string }[] = [
  { value: "registrations", label: "Tickets" },
  { value: "collected", label: "Money" },
]

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** Local midnight of a "yyyy-mm-dd", only for date-fns to put words to. */
const asLocal = (day: string) => new Date(`${day}T00:00:00`)

export const EXPERIENCE_COLOURS: Record<ExperienceLevel | "unknown", string> = {
  beginner: SERIES.blue,
  intermediate: SERIES.teal,
  advanced: SERIES.gold,
  unknown: SERIES.neutral,
}

export function RegistrationsByDay({ totals }: { totals: MeetupTotals }) {
  const [measure, setMeasure] = useState<Measure>("registrations")
  const days = totals.byDay

  const points: AreaPoint[] = days.map((d) => ({
    label: format(asLocal(d.day), "d MMM"),
    title: `${format(asLocal(d.day), "EEEE d MMMM yyyy")} · ${plural(d.registrations, "ticket")}${d.failed ? ` · ${plural(d.failed, "failed attempt")}` : ""}`,
    values: measure === "registrations" ? [d.registrations, d.failed] : [d.collectedPaise],
  }))

  const span =
    days.length > 0
      ? `${format(asLocal(days[0].day), "d MMM")} to ${format(asLocal(days[days.length - 1].day), "d MMM")}`
      : "the last 30 days"

  return (
    <ChartCard
      title="Registrations by day"
      subtitle={
        <>
          <span className="font-semibold text-foreground">{plural(totals.registrations, "ticket")}</span> ·{" "}
          <span className="font-semibold text-foreground">{formatValue(totals.collectedPaise, "inr")}</span> · {span}
          {totals.failedAttempts ? ` · ${plural(totals.failedAttempts, "failed attempt")}` : ""}
        </>
      }
      action={<Segmented options={MEASURES} value={measure} onChange={setMeasure} label="Measure" />}
      className="lg:col-span-2"
    >
      <AreaChart
        key={measure}
        points={points}
        series={
          measure === "registrations"
            ? [
                { name: "Tickets", color: SERIES.blue },
                { name: "Failed attempts", color: SERIES.rose },
              ]
            : [{ name: "Collected", color: SERIES.gold }]
        }
        unit={measure === "registrations" ? "count" : "inr"}
        emptyText="No registrations yet."
      />
      {measure === "registrations" ? (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
          <li className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-3 rounded-full" style={{ background: SERIES.blue }} aria-hidden /> Tickets
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-3 rounded-full" style={{ background: SERIES.rose }} aria-hidden /> Failed attempts
          </li>
        </ul>
      ) : null}
    </ChartCard>
  )
}

export function RegistrationCalendar({ totals }: { totals: MeetupTotals }) {
  const days: HeatmapDay[] = totals.byDay.map((d) => ({
    day: d.day,
    label: format(asLocal(d.day), "d MMM"),
    value: d.registrations,
    detail: `${plural(d.registrations, "ticket")}${d.collectedPaise ? ` · ${formatValue(d.collectedPaise, "inr")}` : ""}`,
  }))
  return (
    <ChartCard title="Calendar" subtitle="One square per day; darker is busier">
      <CalendarHeatmap days={days} unit="count" color={SERIES.blue} weeks={20} emptyText="No registrations on any day yet." />
    </ChartCard>
  )
}

export function ExperienceSplit({ totals, href }: { totals: MeetupTotals; href: (level: ExperienceLevel) => string }) {
  const parts: Part[] = (["beginner", "intermediate", "advanced", "unknown"] as const).map((level) => ({
    key: level,
    label: EXPERIENCE_LABELS[level],
    value: totals.byExperience[level],
    color: EXPERIENCE_COLOURS[level],
    hint: level === "unknown" ? "Something else, or left blank" : undefined,
    href: level === "unknown" ? undefined : href(level),
  }))
  return (
    <ChartCard title="Trading experience" subtitle="What registrants said on the form">
      <DonutChart parts={parts} unit="count" emptyText="No registrations yet.">
        <span className="text-2xl font-bold tracking-tight text-foreground">{totals.registrations}</span>
        <span className="text-[0.625rem] font-semibold uppercase tracking-wider text-muted-foreground">
          {totals.registrations === 1 ? "registrant" : "registrants"}
        </span>
      </DonutChart>
    </ChartCard>
  )
}

export function CitySplit({ totals }: { totals: MeetupTotals }) {
  return (
    <ChartCard title="Cities" subtitle="Where registrants are coming from, most first">
      <RankedBars
        items={totals.byCity.map((c) => ({ key: c.city, label: c.city, value: c.registrations }))}
        unit="count"
        color={SERIES.teal}
        emptyText="No cities yet."
      />
    </ChartCard>
  )
}
