import { z } from "zod"

/** A Razorpay subscription ID, which is how the payments service keys a subscriber. */
export const subscriptionIdSchema = z
  .string()
  .regex(/^sub_[A-Za-z0-9]+$/, "Not a Razorpay subscription ID")

export const setTradingViewAccessSchema = z.object({
  subscriptionId: subscriptionIdSchema,
  granted: z.boolean(),
})

export type SetTradingViewAccessValues = z.infer<typeof setTradingViewAccessSchema>
