import { z } from "zod"

import { MIN_PASSWORD_LENGTH } from "./team"

/** Editing your own account. Email and role are deliberately absent. */
export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
})

/**
 * Changing your own password.
 *
 * The current password is required even though you are already signed in: it
 * stops someone who walks up to an unlocked laptop from silently taking over
 * the account, which is the whole point of asking.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `At least ${MIN_PASSWORD_LENGTH} characters`)
      .max(128),
    confirmPassword: z.string().min(1, "Repeat the new password"),
  })
  .superRefine((val, ctx) => {
    if (val.newPassword !== val.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "The two passwords do not match",
      })
    }
    if (val.currentPassword === val.newPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["newPassword"],
        message: "The new password must be different",
      })
    }
  })

export type UpdateProfileValues = z.infer<typeof updateProfileSchema>
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>
export { MIN_PASSWORD_LENGTH }
