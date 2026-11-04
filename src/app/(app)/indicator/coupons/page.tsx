import Link from "next/link"
import { CircleAlert, Sparkles, Tag, Ticket } from "lucide-react"

import { DataTable, type Column } from "@/components/data-table/table"
import { RazorpayId, When } from "@/components/indicator/cells"
import { IndicatorToolbar } from "@/components/indicator/toolbar"
import { IndicatorUnavailable } from "@/components/indicator/unavailable"
import { PageHeader, SectionHeading } from "@/components/page-header"
import { EmptyState, StatusPill, type StatusTone } from "@/components/ui/status"
import { formatIST } from "@/lib/fy"
import {
  COUPON_STATE_LABELS,
  describeDiscount,
  PAYMENT_METHOD_LABELS,
  planLabel,
  type Coupon,
  type CouponsPayload,
  type CouponState,
  type RazorpayOffer,
} from "@/lib/indicator"
import { can } from "@/lib/permissions"
import type { RawParam } from "@/lib/search-params"
import { requirePermissionPage } from "@/lib/session"
import { getCoupons, PaymentsApiError } from "@/server/indicator/api"
import { fromRecord, hrefWith, modeParam } from "@/server/indicator/filters"
import {
  AddOfferDialog,
  CouponActiveButton,
  DeleteCouponButton,
  EditCouponDialog,
  NewCouponDialog,
  OfferSwitch,
  RemoveOfferButton,
} from "./coupon-dialogs"

export const dynamic = "force-dynamic"
export const metadata = { title: "Coupons" }

const PATH = "/indicator/coupons"

const STATE_TONES: Record<CouponState, StatusTone> = {
  live: "paid",
  paused: "muted",
  expired: "muted",
  used_up: "neutral",
  scheduled: "info",
  no_offers: "overdue",
}

/** "1-month 10% off · 3-month 15% off", each with a warning if an offer is missing. */
function DiscountSummary({ coupon }: { coupon: Coupon }) {
  const entries = Object.entries(coupon.coverage)
  return (
    <ul className="space-y-1 text-sm">
      {entries.map(([key, cover]) => {
        if (!cover) return null
        return (
          <li key={key} className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span className="font-medium">{planLabel({ key })}</span>
            <span className="text-muted-foreground">{describeDiscount(cover.discount)}</span>
            {cover.missing.length > 0 ? (
              <span className="inline-flex items-center gap-1 text-xs text-overdue-foreground">
                <CircleAlert className="size-3.5" aria-hidden />
                {cover.methods.length === 0
                  ? "no Razorpay offer yet"
                  : `${cover.missing.map((m) => PAYMENT_METHOD_LABELS[m]).join(" and ")} offer missing`}
              </span>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

function validityText(coupon: Pick<Coupon, "startsAt" | "endsAt">): string {
  const from = coupon.startsAt ? formatIST(coupon.startsAt, "d MMM yyyy") : null
  const until = coupon.endsAt ? formatIST(coupon.endsAt, "d MMM yyyy") : null
  return from && until ? `${from} – ${until}` : from ? `From ${from}` : until ? `Until ${until}` : "No end date"
}

function Validity({ coupon }: { coupon: Coupon }) {
  return <span className="text-sm text-muted-foreground">{validityText(coupon)}</span>
}

type Offer = { name: string; coupons: Coupon[] }

/**
 * Codes that share a name are one offer: DIWALI20 and DIWALI30 are both
 * "Diwali offer", and get one card with one switch. A name used by a single
 * code is just its note.
 */
function offersOf(coupons: Coupon[]): Offer[] {
  const groups = new Map<string, Offer>()
  for (const coupon of coupons) {
    const name = coupon.label?.trim()
    if (!name) continue
    const key = name.toLowerCase()
    const group = groups.get(key) ?? { name, coupons: [] }
    group.coupons.push(coupon)
    groups.set(key, group)
  }
  return [...groups.values()]
    .filter((offer) => offer.coupons.length > 1)
    .map((offer) => ({ ...offer, coupons: [...offer.coupons].sort((a, b) => a.code.localeCompare(b.code)) }))
}

/** Whole days from now to the end of an offer, for "12 days left". */
function daysLeft(endsAt: string, now: Date): number {
  return Math.ceil((new Date(endsAt).getTime() - now.getTime()) / 86_400_000)
}

function OfferCard({
  offer,
  mode,
  modeName,
  canManage,
  now,
}: {
  offer: Offer
  mode: "test" | "live" | undefined
  modeName: string
  canManage: boolean
  now: Date
}) {
  const { name, coupons } = offer
  const on = coupons.filter((c) => c.active).length
  const ended = coupons.every((c) => c.endsAt && new Date(c.endsAt) < now)
  const uses = coupons.reduce((sum, c) => sum + c.uses, 0)
  // One validity line when every code runs for the same dates; otherwise each code shows its own.
  const sameDates = coupons.every((c) => c.startsAt === coupons[0]!.startsAt && c.endsAt === coupons[0]!.endsAt)
  const endsAt = sameDates ? coupons[0]!.endsAt : null
  const left = endsAt ? daysLeft(endsAt, now) : null

  const state: { tone: StatusTone; label: string } = ended
    ? { tone: "muted", label: "Ended" }
    : on === 0
      ? { tone: "muted", label: "Switched off" }
      : on === coupons.length
        ? { tone: "paid", label: "On" }
        : { tone: "pending", label: `${on} of ${coupons.length} codes on` }

  return (
    <section
      aria-label={`${name} offer`}
      className="glass rounded-3xl p-5"
      data-testid="offer-card"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className="size-4 text-primary" aria-hidden />
            {name}
            <StatusPill tone={state.tone}>{state.label}</StatusPill>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {sameDates ? validityText(coupons[0]!) : "Each code has its own dates"}
            {left !== null && !ended ? ` · ${left === 1 ? "last day" : `${left} days left`}` : null}
            {` · used ${uses === 1 ? "once" : `${uses} times`} in ${modeName} mode`}
          </p>
        </div>
        {canManage ? <OfferSwitch name={name} coupons={coupons} /> : null}
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {coupons.map((coupon) => (
          <li key={coupon.id} className="glass-tint rounded-2xl px-3.5 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-sm font-semibold">{coupon.code}</span>
              <StatusPill tone={STATE_TONES[coupon.state]}>{COUPON_STATE_LABELS[coupon.state]}</StatusPill>
            </div>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <DiscountSummary coupon={coupon} />
              <Link
                href={hrefWith("/indicator/subscribers", { coupon: coupon.code, mode })}
                className="text-xs text-muted-foreground tabular-nums hover:text-primary"
                title="See who used it"
              >
                {coupon.uses === 1 ? "used once" : `used ${coupon.uses} times`}
              </Link>
            </div>
            {!sameDates ? <p className="mt-1 text-xs text-muted-foreground">{validityText(coupon)}</p> : null}
          </li>
        ))}
      </ul>
      {canManage ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {on > 0
            ? "Switch off ends the offer early for every code at once; the dates stay as they are, so it can be switched on again."
            : "Switch on brings every code back, with the dates it had."}
        </p>
      ) : null}
    </section>
  )
}

export default async function CouponsPage({ searchParams }: { searchParams: Promise<Record<string, RawParam>> }) {
  const user = await requirePermissionPage("VIEW_INDICATOR")
  const raw = await searchParams
  const requestedMode = modeParam(fromRecord(raw))
  const canManage = can(user, "MANAGE_COUPONS")

  let data: CouponsPayload
  try {
    data = await getCoupons(requestedMode)
  } catch (error) {
    if (!(error instanceof PaymentsApiError)) throw error
    return (
      <div className="pb-8">
        <PageHeader title="Coupons" />
        <IndicatorUnavailable error={error} />
      </div>
    )
  }

  const mode = data.mode === data.serviceMode ? undefined : data.mode
  const modeName = data.mode === "test" ? "Test" : "Live"

  const couponColumns: Column<Coupon>[] = [
    {
      id: "code",
      header: "Code",
      priority: "primary",
      cell: (row) => (
        <div className="min-w-0">
          <span className="font-mono text-sm font-semibold">{row.code}</span>
          {row.label ? <span className="block text-xs text-muted-foreground">{row.label}</span> : null}
        </div>
      ),
    },
    {
      id: "state",
      header: "Status",
      priority: "primary",
      align: "right",
      hideLabelOnCard: true,
      cell: (row) => <StatusPill tone={STATE_TONES[row.state]}>{COUPON_STATE_LABELS[row.state]}</StatusPill>,
    },
    {
      id: "discount",
      header: "First payment",
      priority: "secondary",
      cell: (row) => <DiscountSummary coupon={row} />,
    },
    {
      id: "uses",
      header: `Used (${modeName.toLowerCase()})`,
      priority: "secondary",
      cell: (row) => (
        <Link
          href={hrefWith("/indicator/subscribers", { coupon: row.code, mode })}
          className="tabular-nums hover:text-primary"
          title="See who used it"
        >
          {row.uses}
          {row.maxUses !== null ? <span className="text-muted-foreground"> / {row.maxUses}</span> : null}
        </Link>
      ),
    },
    {
      id: "validity",
      header: "Valid",
      priority: "tertiary",
      cell: (row) => (
        <div>
          <Validity coupon={row} />
          <span className="block text-xs text-muted-foreground">{row.onePerBuyer ? "One per buyer" : "Any number per buyer"}</span>
        </div>
      ),
    },
    ...(canManage
      ? [
          {
            id: "actions",
            header: "",
            align: "right" as const,
            cell: (row: Coupon) => (
              <span className="inline-flex items-center gap-0.5">
                <EditCouponDialog coupon={row} used={row.uses > 0} />
                <CouponActiveButton coupon={row} />
                {row.uses === 0 ? <DeleteCouponButton coupon={row} /> : null}
              </span>
            ),
          },
        ]
      : []),
  ]

  const offerColumns: Column<RazorpayOffer>[] = [
    {
      id: "offer",
      header: "Razorpay offer",
      priority: "primary",
      cell: (row) => (
        <div className="min-w-0">
          <RazorpayId id={row.offerId} label="offer ID" />
          {row.label ? <span className="block text-xs text-muted-foreground">{row.label}</span> : null}
        </div>
      ),
    },
    {
      id: "gives",
      header: "Gives",
      priority: "primary",
      align: "right",
      hideLabelOnCard: true,
      cell: (row) => (
        <span className="text-sm">
          {describeDiscount(row.discount)} · {planLabel({ key: row.planKey })} · {PAYMENT_METHOD_LABELS[row.method]}
        </span>
      ),
    },
    {
      id: "health",
      header: "Last used",
      priority: "secondary",
      cell: (row) =>
        row.lastError ? (
          <span className="inline-flex items-start gap-1 text-xs text-overdue-foreground">
            <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              Razorpay refused it{row.lastErrorAt ? ` on ${formatIST(row.lastErrorAt, "d MMM, h:mm a")}` : ""}: {row.lastError}
            </span>
          </span>
        ) : (
          <When iso={row.lastUsedAt} pattern="d MMM yyyy, h:mm a" />
        ),
    },
    ...(canManage
      ? [
          {
            id: "actions",
            header: "",
            align: "right" as const,
            cell: (row: RazorpayOffer) => <RemoveOfferButton offerId={row.offerId} />,
          },
        ]
      : []),
  ]

  const problems = data.coupons.filter((c) => c.active && Object.values(c.coverage).some((cover) => cover && cover.missing.length > 0))
  const offers = offersOf(data.coupons)
  const now = new Date()

  return (
    <div className="pb-8">
      <PageHeader
        title="Coupons"
        description="Codes buyers type at checkout for money off their first payment. Renewals are always full price. Switch off ends a code or an offer early."
        actions={canManage ? <NewCouponDialog /> : undefined}
      />
      <IndicatorToolbar path={PATH} mode={data.mode} serviceMode={data.serviceMode} generatedAt={data.generatedAt} />

      {problems.length > 0 ? (
        <div className="px-4 pt-4 sm:px-6">
          <p
            role="status"
            className="glass-tint flex items-start gap-2.5 rounded-2xl border-pending/40 bg-pending-muted px-4 py-3 text-sm text-pending-foreground"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {problems.length === 1 ? `Coupon ${problems[0]!.code} is` : `${problems.length} coupons are`} missing a Razorpay offer in{" "}
              {modeName} mode, so {problems.length === 1 ? "it" : "they"} can&apos;t be used for every payment method yet. Register
              the offers below.
            </span>
          </p>
        </div>
      ) : null}

      {offers.length > 0 ? (
        <div className="grid gap-4 px-4 pt-4 sm:px-6">
          {offers.map((offer) => (
            <OfferCard key={offer.name.toLowerCase()} offer={offer} mode={mode} modeName={modeName} canManage={canManage} now={now} />
          ))}
        </div>
      ) : null}

      <div className="pt-4">
        {data.coupons.length === 0 ? (
          <div className="px-4 sm:px-6">
            <EmptyState
              icon={<Ticket className="size-5" />}
              title="No coupons yet"
              description={
                canManage
                  ? "Register the Razorpay offers below, then make a code with “New coupon”."
                  : "A superadmin can make coupon codes here."
              }
            />
          </div>
        ) : (
          <DataTable columns={couponColumns} rows={data.coupons} rowKey={(row) => String(row.id)} />
        )}
      </div>

      <div className="mt-8 px-4 sm:px-6">
        <SectionHeading action={canManage ? <AddOfferDialog mode={data.mode} /> : undefined}>
          Razorpay offers · {modeName} mode
        </SectionHeading>
        <p className="mt-1 mb-3 text-sm text-muted-foreground">
          A coupon&apos;s discount is applied by a Razorpay offer, which works for one plan and one payment method. Make each offer in the
          Razorpay dashboard ({modeName} Mode → Offers (search &ldquo;Offers&rdquo;, or Affordability → Offers) → Create New Offer →
          Offers on Subscriptions, redemption &ldquo;Single Use&rdquo;) and register it here. For 20% off the 1-month plan by UPI and card,
          that is two offers.
        </p>
      </div>
      {data.offers.length === 0 ? (
        <div className="px-4 sm:px-6">
          <EmptyState icon={<Tag className="size-5" />} title={`No Razorpay offers registered in ${modeName} mode`} description="Coupons can't be used until their offers are here." />
        </div>
      ) : (
        <DataTable columns={offerColumns} rows={data.offers} rowKey={(row) => row.offerId} />
      )}
    </div>
  )
}
