"use client"

import { useState } from "react"

import { ChartCard, Segmented } from "./chart-card"
import { ColumnChart, type ColumnPoint } from "./column-chart"
import { formatValue, SERIES } from "./palette"
import type { DayPoint, MonthPoint } from "@/lib/chart-data"

/*
 * The time charts, under one control: the last 30 days by day, or the last
 * 12 months by month. One choice scopes both charts so they always agree. The
 * other panes of the sales grid are rendered on the server and passed in.
 */

type Range = "30d" | "12m"

const RANGES: { value: Range; label: string }[] = [
  { value: "30d", label: "30 days" },
  { value: "12m", label: "12 months" },
]

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export function SalesCharts({
  days,
  months,
  planMix,
  methods,
  renewals,
}: {
  days: DayPoint[]
  months: MonthPoint[]
  planMix: React.ReactNode
  methods: React.ReactNode
  renewals: React.ReactNode
}) {
  const [range, setRange] = useState<Range>("30d")

  const source = range === "30d" ? days : months
  const collected = source.reduce((sum, p) => sum + p.collectedPaise, 0)
  const purchases = source.reduce((sum, p) => sum + p.purchases, 0)
  const firsts = source.reduce((sum, p) => sum + p.firstPurchases, 0)
  const renewed = source.reduce((sum, p) => sum + p.renewals, 0)
  const period = range === "30d" ? "in the last 30 days" : "in the last 12 months"

  const title = (point: DayPoint | MonthPoint) =>
    "longLabel" in point ? point.longLabel : `${point.label} · ${plural(point.purchases, "purchase")}`

  const collections: ColumnPoint[] = source.map((point) => ({
    label: point.label,
    title: title(point),
    values: [point.collectedPaise],
  }))
  const mix: ColumnPoint[] = source.map((point) => ({
    label: point.label,
    title: title(point),
    values: [point.firstPurchases, point.renewals],
  }))

  return (
    <div className="stagger grid grid-cols-1 gap-4 lg:grid-cols-3">
      <ChartCard
        title="Collections"
        subtitle={
          <>
            <span className="font-semibold text-foreground">{formatValue(collected, "inr")}</span> {period} ·{" "}
            {plural(purchases, "purchase")}
          </>
        }
        action={<Segmented options={RANGES} value={range} onChange={setRange} label="Period" />}
        className="lg:col-span-2"
      >
        <ColumnChart
          key={range}
          points={collections}
          series={[{ name: "Collected", color: SERIES.gold }]}
          unit="inr"
          emptyText={`No purchases ${period}.`}
        />
      </ChartCard>

      {planMix}

      <ChartCard
        title="New buyers and renewals"
        subtitle={
          <>
            <span className="font-semibold text-foreground">{firsts}</span> first {firsts === 1 ? "purchase" : "purchases"} ·{" "}
            <span className="font-semibold text-foreground">{renewed}</span> {renewed === 1 ? "renewal" : "renewals"} {period}
          </>
        }
      >
        <ColumnChart
          key={range}
          points={mix}
          series={[
            { name: "First purchases", color: SERIES.blue },
            { name: "Renewals", color: SERIES.teal },
          ]}
          unit="count"
          height={196}
          emptyText={`No purchases ${period}.`}
        />
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
          <li className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: SERIES.blue }} aria-hidden /> First purchases
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: SERIES.teal }} aria-hidden /> Renewals
          </li>
        </ul>
      </ChartCard>

      {methods}
      {renewals}
    </div>
  )
}
