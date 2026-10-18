/**
 * Every pg enum in the system, in one place so the vocabulary is auditable.
 *
 * Only one is left. The student-CRM enums (programs, enrollments, payments,
 * messaging) went with their tables in migration 0007; indicator subscribers
 * and payments live in the shubztrader-payments service, not here.
 */

import { pgEnum } from "drizzle-orm/pg-core"

/**
 * SUPERADMIN is first because it outranks everything: it is the only role that
 * can manage team members, and the only one that can mint another superadmin.
 * The enum is declared in privilege order, so ORDER BY role sorts by rank.
 */
export const userRoleEnum = pgEnum("user_role", ["SUPERADMIN", "ADMIN"])
