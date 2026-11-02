"use server"

/**
 * Coupon codes and the Razorpay offers behind them.
 *
 * Same shape as the TradingView tick: zod parse, authorise, change in the
 * payments service, audit here once it has confirmed, revalidate. Coupons are
 * money, so every change is audited with its before and after.
 */

import { mutate, type Actor } from "@/lib/audit"
import type { Coupon, RazorpayOffer } from "@/lib/indicator"
import { revalidateEverything } from "@/lib/revalidate"
import { checkPermission } from "@/lib/session"
import {
  couponFormSchema,
  couponIdSchema,
  offerFormSchema,
  offerIdSchema,
  setCouponActiveSchema,
  setOfferActiveSchema,
  updateCouponSchema,
  type CouponFormParsed,
} from "@/lib/validation/coupons"
import type { ActionResult } from "@/lib/validation/shared"
import {
  addRazorpayOffer,
  createCoupon,
  deleteCoupon,
  PaymentsApiError,
  removeRazorpayOffer,
  setCouponActive,
  setCouponsActive,
  updateCoupon,
  type CouponInput,
} from "./api"

/** A date from the form is a calendar day in India: it starts at midnight and ends just before the next. */
function toInput(values: CouponFormParsed): CouponInput {
  return {
    code: values.code,
    label: values.label,
    discounts: values.discounts,
    startsAt: values.startsAt ? `${values.startsAt}T00:00:00.000+05:30` : null,
    endsAt: values.endsAt ? `${values.endsAt}T23:59:59.999+05:30` : null,
    maxUses: values.maxUses,
    onePerBuyer: values.onePerBuyer,
    active: values.active,
  }
}

function failure(error: unknown): ActionResult<never> {
  if (error instanceof PaymentsApiError) {
    const fieldErrors =
      error.kind === "conflict" && /code/i.test(error.message) ? { code: error.message } : undefined
    return { ok: false, error: error.message, fieldErrors }
  }
  throw error
}

async function audit(
  actor: Actor,
  action: string,
  entity: "coupon" | "razorpay_offer",
  entityId: string,
  before: unknown,
  after: unknown
) {
  try {
    await mutate(actor, async ({ audit }) => {
      await audit({ action, entity, entityId, before, after })
    })
  } catch (error) {
    console.error(`Audit write failed after ${action}:`, error)
  }
}

export async function createCouponAction(input: unknown): Promise<ActionResult<Coupon>> {
  const gate = await checkPermission("MANAGE_COUPONS")
  if (!gate.ok) return gate
  const parsed = couponFormSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields." }

  let result: { coupon: Coupon }
  try {
    result = await createCoupon(toInput(parsed.data), gate.user.name)
  } catch (error) {
    return failure(error)
  }
  await audit(gate.user, "COUPON_CREATED", "coupon", String(result.coupon.id), null, result.coupon)
  revalidateEverything()
  return { ok: true, data: result.coupon }
}

export async function updateCouponAction(input: unknown): Promise<ActionResult<Coupon>> {
  const gate = await checkPermission("MANAGE_COUPONS")
  if (!gate.ok) return gate
  const parsed = updateCouponSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields." }

  let result: { coupon: Coupon }
  try {
    result = await updateCoupon(parsed.data.id, toInput(parsed.data.values), gate.user.name)
  } catch (error) {
    return failure(error)
  }
  await audit(gate.user, "COUPON_UPDATED", "coupon", String(result.coupon.id), parsed.data.values, result.coupon)
  revalidateEverything()
  return { ok: true, data: result.coupon }
}

export async function setCouponActiveAction(input: unknown): Promise<ActionResult<Coupon>> {
  const gate = await checkPermission("MANAGE_COUPONS")
  if (!gate.ok) return gate
  const parsed = setCouponActiveSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Unknown request." }

  let result: { coupon: Coupon }
  try {
    result = await setCouponActive(parsed.data.id, parsed.data.active, gate.user.name)
  } catch (error) {
    return failure(error)
  }
  await audit(
    gate.user,
    parsed.data.active ? "COUPON_SWITCHED_ON" : "COUPON_SWITCHED_OFF",
    "coupon",
    String(parsed.data.id),
    { active: !parsed.data.active },
    { active: parsed.data.active, code: result.coupon.code }
  )
  revalidateEverything()
  return { ok: true, data: result.coupon }
}

/** The one button for an offer made of several codes (DIWALI20 and DIWALI30): off, or on, together. */
export async function setOfferActiveAction(input: unknown): Promise<ActionResult<Coupon[]>> {
  const gate = await checkPermission("MANAGE_COUPONS")
  if (!gate.ok) return gate
  const parsed = setOfferActiveSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Unknown request." }

  let result: { coupons: Coupon[] }
  try {
    result = await setCouponsActive(parsed.data.ids, parsed.data.active, gate.user.name)
  } catch (error) {
    return failure(error)
  }
  // One audit row per code, so each coupon's history stays complete.
  const action = parsed.data.active ? "OFFER_SWITCHED_ON" : "OFFER_SWITCHED_OFF"
  const codes = result.coupons.map((c) => c.code)
  try {
    await mutate(gate.user, async ({ audit }) => {
      for (const coupon of result.coupons) {
        await audit({
          action,
          entity: "coupon",
          entityId: String(coupon.id),
          before: { active: !parsed.data.active },
          after: { active: parsed.data.active, code: coupon.code, offer: codes },
        })
      }
    })
  } catch (error) {
    console.error(`Audit write failed after ${action}:`, error)
  }
  revalidateEverything()
  return { ok: true, data: result.coupons }
}

export async function deleteCouponAction(input: unknown): Promise<ActionResult<void>> {
  const gate = await checkPermission("MANAGE_COUPONS")
  if (!gate.ok) return gate
  const parsed = couponIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Unknown request." }

  try {
    await deleteCoupon(parsed.data.id)
  } catch (error) {
    return failure(error)
  }
  await audit(gate.user, "COUPON_DELETED", "coupon", String(parsed.data.id), { id: parsed.data.id }, null)
  revalidateEverything()
  return { ok: true, data: undefined }
}

export async function addOfferAction(input: unknown): Promise<ActionResult<RazorpayOffer>> {
  const gate = await checkPermission("MANAGE_COUPONS")
  if (!gate.ok) return gate
  const parsed = offerFormSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields." }
  const mode = (input as { mode?: unknown })?.mode
  if (mode !== "test" && mode !== "live") return { ok: false, error: "Unknown request." }

  let result: { offer: RazorpayOffer }
  try {
    result = await addRazorpayOffer(
      {
        offerId: parsed.data.offerId,
        mode,
        planKey: parsed.data.planKey,
        method: parsed.data.method,
        discount: parsed.data.discount!,
        label: parsed.data.label,
      },
      gate.user.name
    )
  } catch (error) {
    return failure(error)
  }
  await audit(gate.user, "RAZORPAY_OFFER_ADDED", "razorpay_offer", result.offer.offerId, null, result.offer)
  revalidateEverything()
  return { ok: true, data: result.offer }
}

export async function removeOfferAction(input: unknown): Promise<ActionResult<void>> {
  const gate = await checkPermission("MANAGE_COUPONS")
  if (!gate.ok) return gate
  const parsed = offerIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Unknown request." }

  try {
    await removeRazorpayOffer(parsed.data.offerId)
  } catch (error) {
    return failure(error)
  }
  await audit(gate.user, "RAZORPAY_OFFER_REMOVED", "razorpay_offer", parsed.data.offerId, { offerId: parsed.data.offerId }, null)
  revalidateEverything()
  return { ok: true, data: undefined }
}
