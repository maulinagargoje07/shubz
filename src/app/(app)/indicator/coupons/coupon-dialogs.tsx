"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, type Path } from "react-hook-form"
import { Pencil, Plus, Power, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  type FormContext,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { toISTDateString } from "@/lib/fy"
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS, type Coupon, type IndicatorMode } from "@/lib/indicator"
import {
  couponFormSchema,
  EMPTY_COUPON,
  offerFormSchema,
  PLAN_OPTIONS,
  type CouponFormParsed,
  type CouponFormValues,
  type OfferFormParsed,
  type OfferFormValues,
} from "@/lib/validation/coupons"
import {
  addOfferAction,
  createCouponAction,
  deleteCouponAction,
  removeOfferAction,
  setCouponActiveAction,
  setOfferActiveAction,
  updateCouponAction,
} from "@/server/indicator/coupon-actions"

/* A native select on the same glass as the inputs (the focus ring is the control's own). */
const selectClass = "glass-control h-9 w-full rounded-xl px-2.5 text-sm text-foreground outline-none disabled:opacity-50"

/** A discount as typed: type select beside a number, with the unit after it. */
function DiscountFields({
  form,
  base,
  allowNone,
  label,
}: {
  form: ReturnType<typeof useForm<CouponFormValues, FormContext, CouponFormParsed>>
  base: "discounts.1m" | "discounts.3m"
  allowNone: boolean
  label: string
}) {
  const type = form.watch(`${base}.type` as Path<CouponFormValues>) as string
  return (
    <FormField
      control={form.control}
      name={`${base}.value` as Path<CouponFormValues>}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <div className="flex gap-2">
            <select
              aria-label={`${label}: type of discount`}
              className={cn(selectClass, "w-36 shrink-0")}
              value={type}
              onChange={(event) => {
                form.setValue(`${base}.type` as Path<CouponFormValues>, event.target.value)
                form.clearErrors(`${base}.value` as Path<CouponFormValues>)
              }}
            >
              {allowNone ? <option value="none">No discount</option> : null}
              <option value="percent">Percent off</option>
              <option value="flat">Rupees off</option>
            </select>
            <FormControl>
              <Input
                type="text"
                inputMode="decimal"
                placeholder={type === "percent" ? "10" : type === "flat" ? "500" : "—"}
                disabled={type === "none"}
                value={String(field.value ?? "")}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                className="flex-1"
              />
            </FormControl>
            <span className="self-center text-sm text-muted-foreground w-5">{type === "percent" ? "%" : type === "flat" ? "₹" : ""}</span>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function CouponForm({
  form,
  onSubmit,
  submitLabel,
  busyLabel,
  onCancel,
  codeLocked,
}: {
  form: ReturnType<typeof useForm<CouponFormValues, FormContext, CouponFormParsed>>
  onSubmit: () => Promise<void>
  submitLabel: string
  busyLabel: string
  onCancel: () => void
  /** The code can't change once buyers have used it. */
  codeLocked: boolean
}) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Code</FormLabel>
                <FormControl>
                  <Input
                    placeholder="DIWALI20"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    className="font-mono uppercase"
                    disabled={codeLocked}
                    {...field}
                    onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                  />
                </FormControl>
                {codeLocked ? (
                  <FormDescription>Buyers have used this code, so it can&apos;t be renamed.</FormDescription>
                ) : (
                  <FormDescription>What the buyer types. Letters, numbers, - and _.</FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="label"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Offer name (optional)</FormLabel>
                <FormControl>
                  <Input placeholder="Diwali offer" autoComplete="off" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormDescription>
                  Shown to buyers next to the code. Codes that share a name are shown together as one offer, with one switch.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="glass-tint space-y-3 rounded-2xl p-3">
          <p className="text-sm font-medium">Off the first payment</p>
          <DiscountFields form={form} base="discounts.1m" allowNone label="1-month plan" />
          <DiscountFields form={form} base="discounts.3m" allowNone label="3-month plan" />
          <p className="text-xs text-muted-foreground">
            Renewals are always full price. Each discount needs a matching Razorpay offer registered below for UPI and for cards.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="startsAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valid from</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormDescription>Blank: right away.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="endsAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valid until</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormDescription>Blank: no end date.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="maxUses"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Max uses</FormLabel>
                <FormControl>
                  <Input type="text" inputMode="numeric" placeholder="Unlimited" {...field} value={String(field.value ?? "")} />
                </FormControl>
                <FormDescription>Paid purchases, per mode.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="onePerBuyer"
            render={({ field }) => (
              <FormItem>
                <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-glass-rim px-3 py-2.5 text-sm transition-colors hover:bg-glass-hover">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 accent-primary"
                    checked={Boolean(field.value)}
                    onChange={(event) => field.onChange(event.target.checked)}
                  />
                  <span>
                    <span className="block font-medium">One use per buyer</span>
                    <span className="block text-xs text-muted-foreground">
                      The same email or TradingView username can&apos;t use it twice.
                    </span>
                  </span>
                </label>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="active"
            render={({ field }) => (
              <FormItem>
                <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-glass-rim px-3 py-2.5 text-sm transition-colors hover:bg-glass-hover">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 accent-primary"
                    checked={Boolean(field.value)}
                    onChange={(event) => field.onChange(event.target.checked)}
                  />
                  <span>
                    <span className="block font-medium">Active</span>
                    <span className="block text-xs text-muted-foreground">Untick to pause it without deleting it.</span>
                  </span>
                </label>
              </FormItem>
            )}
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? busyLabel : submitLabel}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  )
}

function applyFieldErrors(
  form: ReturnType<typeof useForm<CouponFormValues, FormContext, CouponFormParsed>>,
  fieldErrors: Record<string, string> | undefined
) {
  for (const [field, message] of Object.entries(fieldErrors ?? {})) {
    form.setError(field as Path<CouponFormValues>, { message })
  }
}

// ------------------------------------------------------------------ create

export function NewCouponDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const form = useForm<CouponFormValues, FormContext, CouponFormParsed>({
    resolver: zodResolver(couponFormSchema),
    defaultValues: EMPTY_COUPON,
  })

  async function onSubmit() {
    const result = await createCouponAction(form.getValues())
    if (!result.ok) {
      applyFieldErrors(form, result.fieldErrors)
      toast.error(result.error)
      return
    }
    toast.success(`Coupon ${result.data.code} created`)
    form.reset(EMPTY_COUPON)
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Plus className="size-4" />
            New coupon
          </Button>
        }
      />
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New coupon</DialogTitle>
        </DialogHeader>
        <CouponForm
          form={form}
          onSubmit={onSubmit}
          submitLabel="Create coupon"
          busyLabel="Creating…"
          onCancel={() => setOpen(false)}
          codeLocked={false}
        />
      </DialogContent>
    </Dialog>
  )
}

// -------------------------------------------------------------------- edit

function toFormValues(coupon: Coupon): CouponFormValues {
  const discount = (key: "1m" | "3m") => {
    const d = coupon.discounts[key]
    if (!d) return { type: "none" as const, value: "" }
    return { type: d.type, value: d.type === "percent" ? String(d.value) : String(d.value / 100) }
  }
  return {
    code: coupon.code,
    label: coupon.label ?? "",
    discounts: { "1m": discount("1m"), "3m": discount("3m") },
    startsAt: coupon.startsAt ? toISTDateString(new Date(coupon.startsAt)) : "",
    endsAt: coupon.endsAt ? toISTDateString(new Date(coupon.endsAt)) : "",
    maxUses: coupon.maxUses === null ? "" : String(coupon.maxUses),
    onePerBuyer: coupon.onePerBuyer,
    active: coupon.active,
  }
}

export function EditCouponDialog({ coupon, used }: { coupon: Coupon; used: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const form = useForm<CouponFormValues, FormContext, CouponFormParsed>({
    resolver: zodResolver(couponFormSchema),
    defaultValues: toFormValues(coupon),
  })

  async function onSubmit() {
    const result = await updateCouponAction({ id: coupon.id, values: form.getValues() })
    if (!result.ok) {
      applyFieldErrors(form, result.fieldErrors)
      toast.error(result.error)
      return
    }
    toast.success(`Coupon ${result.data.code} saved`)
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) form.reset(toFormValues(coupon))
        setOpen(next)
      }}
    >
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon" aria-label={`Edit ${coupon.code}`}>
            <Pencil className="size-4" />
          </Button>
        }
      />
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            Edit <span className="font-mono">{coupon.code}</span>
          </DialogTitle>
        </DialogHeader>
        <CouponForm
          form={form}
          onSubmit={onSubmit}
          submitLabel="Save changes"
          busyLabel="Saving…"
          onCancel={() => setOpen(false)}
          codeLocked={used}
        />
      </DialogContent>
    </Dialog>
  )
}

// --------------------------------------------------- switch off / on, delete

/** One code's switch. Off: buyers can't use it; on: back as it was, dates included. */
export function CouponActiveButton({ coupon }: { coupon: Coupon }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function onToggle() {
    setBusy(true)
    const result = await setCouponActiveAction({ id: coupon.id, active: !coupon.active })
    setBusy(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(coupon.active ? `${coupon.code} switched off` : `${coupon.code} switched on`)
    router.refresh()
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onToggle}
      disabled={busy}
      aria-label={coupon.active ? `Switch off ${coupon.code}` : `Switch on ${coupon.code}`}
      title={coupon.active ? "Buyers can't use it until it's switched on again" : "Buyers can use it again"}
      className={cn("gap-1.5", coupon.active ? "text-muted-foreground hover:text-overdue" : "text-paid")}
    >
      <Power className="size-3.5" />
      {busy ? "…" : coupon.active ? "Switch off" : "Switch on"}
    </Button>
  )
}

/**
 * The switch for an offer made of several codes (the Diwali offer: DIWALI20
 * and DIWALI30). Off while any of them is on; all are changed together.
 */
export function OfferSwitch({ name, coupons }: { name: string; coupons: Coupon[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const anyOn = coupons.some((c) => c.active)
  const codes = coupons.map((c) => c.code).join(" and ")

  async function onToggle() {
    setBusy(true)
    const result = await setOfferActiveAction({ ids: coupons.map((c) => c.id), active: !anyOn })
    setBusy(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(anyOn ? `${name} switched off: ${codes} can't be used` : `${name} switched on: ${codes} work again`)
    router.refresh()
  }

  return (
    <Button
      variant={anyOn ? "outline" : "default"}
      onClick={onToggle}
      disabled={busy}
      aria-label={anyOn ? `Switch off ${name}` : `Switch on ${name}`}
      className={cn("gap-1.5", anyOn && "text-overdue-foreground hover:text-overdue")}
    >
      <Power className="size-4" />
      {busy ? "…" : anyOn ? "Switch off" : "Switch on"}
    </Button>
  )
}

export function DeleteCouponButton({ coupon }: { coupon: Coupon }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function onDelete() {
    if (!window.confirm(`Delete coupon ${coupon.code}? This can't be undone.`)) return
    setBusy(true)
    const result = await deleteCouponAction({ id: coupon.id })
    setBusy(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(`${coupon.code} deleted`)
    router.refresh()
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onDelete}
      disabled={busy}
      aria-label={`Delete ${coupon.code}`}
      className="text-muted-foreground hover:text-overdue"
    >
      <Trash2 className="size-4" />
    </Button>
  )
}

// ------------------------------------------------------------------ offers

const EMPTY_OFFER: OfferFormValues = {
  offerId: "",
  planKey: "1m",
  method: "upi",
  discount: { type: "percent", value: "" },
  label: "",
}

export function AddOfferDialog({ mode }: { mode: IndicatorMode }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const form = useForm<OfferFormValues, FormContext, OfferFormParsed>({
    resolver: zodResolver(offerFormSchema),
    defaultValues: EMPTY_OFFER,
  })
  const discountType = form.watch("discount.type")

  async function onSubmit() {
    const result = await addOfferAction({ ...form.getValues(), mode })
    if (!result.ok) {
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          form.setError(field as Path<OfferFormValues>, { message })
        }
      }
      toast.error(result.error)
      return
    }
    toast.success("Razorpay offer registered")
    form.reset(EMPTY_OFFER)
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <Plus className="size-4" />
            Register Razorpay offer
          </Button>
        }
      />
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Register a Razorpay offer ({mode === "test" ? "Test" : "Live"} mode)</DialogTitle>
        </DialogHeader>
        <p className="-mt-2 text-sm text-muted-foreground">
          Make the offer first in the Razorpay dashboard ({mode === "test" ? "Test" : "Live"} Mode → Subscriptions → Offers →
          Offers on Subscriptions, redemption &ldquo;Single Use&rdquo;), then paste its ID here with what it gives.
        </p>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="offerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Offer ID</FormLabel>
                  <FormControl>
                    <Input placeholder="offer_XXXXXXXXXXXXXX" autoComplete="off" spellCheck={false} className="font-mono" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="planKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plan</FormLabel>
                    <FormControl>
                      <select className={selectClass} value={field.value} onChange={field.onChange} name={field.name}>
                        {PLAN_OPTIONS.map((plan) => (
                          <option key={plan.key} value={plan.key}>
                            {plan.label}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment method</FormLabel>
                    <FormControl>
                      <select className={selectClass} value={field.value} onChange={field.onChange} name={field.name}>
                        {PAYMENT_METHODS.map((method) => (
                          <option key={method} value={method}>
                            {PAYMENT_METHOD_LABELS[method]}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormDescription>As set on the offer&apos;s &ldquo;Applicable on&rdquo; step.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="discount.value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Discount the offer gives</FormLabel>
                  <div className="flex gap-2">
                    <select
                      aria-label="Type of discount"
                      className={cn(selectClass, "w-36 shrink-0")}
                      value={discountType}
                      onChange={(event) => form.setValue("discount.type", event.target.value as "percent" | "flat")}
                    >
                      <option value="percent">Percent off</option>
                      <option value="flat">Rupees off</option>
                    </select>
                    <FormControl>
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder={discountType === "percent" ? "10" : "500"}
                        value={String(field.value ?? "")}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                      />
                    </FormControl>
                    <span className="self-center w-5 text-sm text-muted-foreground">{discountType === "percent" ? "%" : "₹"}</span>
                  </div>
                  <FormDescription>Must match the offer exactly; a coupon is matched to offers by this.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Note (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="10% off 1 month, UPI" autoComplete="off" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Registering…" : "Register offer"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export function RemoveOfferButton({ offerId }: { offerId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function onRemove() {
    if (!window.confirm(`Remove ${offerId} from the CRM? Coupons that need it will stop working for that payment method. The offer itself stays in Razorpay.`)) return
    setBusy(true)
    const result = await removeOfferAction({ offerId })
    setBusy(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Offer removed")
    router.refresh()
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onRemove}
      disabled={busy}
      aria-label={`Remove offer ${offerId}`}
      className="text-muted-foreground hover:text-overdue"
    >
      <Trash2 className="size-4" />
    </Button>
  )
}
