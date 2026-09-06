import { z } from "zod"

import { PERMISSIONS, ROLES, type Permission } from "@/lib/permissions"
import { optionalText, uuidSchema } from "./shared"

/** Better Auth is configured with `minPasswordLength: 10`; keep them in step. */
export const MIN_PASSWORD_LENGTH = 10

const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `At least ${MIN_PASSWORD_LENGTH} characters`)
  .max(128, "That is longer than any password needs to be")

const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .email("Not a valid email")
  // Stored lowercase so "Ravi@x.com" and "ravi@x.com" cannot become two accounts.
  .transform((v) => v.toLowerCase())

const roleSchema = z.enum(ROLES)

/**
 * Permission overrides.
 *
 * `null` means "follow the role's defaults" and is the normal case. An array
 * replaces those defaults entirely — see lib/permissions.ts for why replacement
 * beats an additive model for a UI made of toggles.
 */
const permissionsSchema = z
  .array(z.enum(PERMISSIONS))
  .nullable()
  .optional()
  .transform((v) => (v == null ? null : ([...new Set(v)] as Permission[])))

export const createTeamMemberSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  email: emailSchema,
  password: passwordSchema,
  role: roleSchema,
  permissions: permissionsSchema,
})

export const updateTeamMemberSchema = z.object({
  id: uuidSchema,
  name: z.string().trim().min(2, "Name is required"),
  role: roleSchema,
  permissions: permissionsSchema,
})

export const toggleTeamMemberStatusSchema = z.object({
  id: uuidSchema,
  active: z.boolean(),
})

export const resetTeamMemberPasswordSchema = z.object({
  id: uuidSchema,
  password: passwordSchema,
})

export const teamListParamsSchema = z.object({
  q: z.string().trim().optional().default(""),
  role: roleSchema.optional(),
  status: z.enum(["active", "inactive"]).optional(),
})

export type CreateTeamMemberValues = z.input<typeof createTeamMemberSchema>
export type CreateTeamMemberParsed = z.output<typeof createTeamMemberSchema>
export type UpdateTeamMemberValues = z.input<typeof updateTeamMemberSchema>
export type UpdateTeamMemberParsed = z.output<typeof updateTeamMemberSchema>
export type ResetPasswordValues = z.input<typeof resetTeamMemberPasswordSchema>
export type TeamListParams = z.output<typeof teamListParamsSchema>

export { optionalText }
