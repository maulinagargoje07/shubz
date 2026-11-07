import { z } from "zod"

/** A "yyyy-MM-dd" that is a real calendar date. */
const calendarDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use yyyy-mm-dd")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`)
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  }, "Not a real date")

/** Ask the payments service to read the meetup page's past payments from Razorpay. */
export const meetupBackfillSchema = z.object({
  mode: z.enum(["live", "test"]).optional(),
  from: calendarDay.optional(),
  to: calendarDay.optional(),
})

export type MeetupBackfillValues = z.infer<typeof meetupBackfillSchema>
