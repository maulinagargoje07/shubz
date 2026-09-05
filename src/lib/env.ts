/**
 * Environment configuration, validated once at startup.
 *
 * Fail loudly and early: a missing DATABASE_URL should stop the process with a
 * clear message, not surface as a connection error on the first page load.
 *
 * This module is server-only. Nothing here may be imported into a client
 * component — DATABASE_URL and BETTER_AUTH_SECRET must never reach a browser
 * bundle. Non-NEXT_PUBLIC_ variables are not inlined into client bundles, so a
 * stray import fails loudly at build rather than leaking a secret, but the
 * rule stands: server code only.
 */

import { z } from "zod"

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required — see README for Railway setup")
    .refine(
      (v) => v.startsWith("postgres://") || v.startsWith("postgresql://"),
      "DATABASE_URL must be a postgres:// or postgresql:// connection string"
    ),

  /** Signs session cookies. Rotating it logs everyone out. */
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),

  /** Public origin, e.g. https://shubztrader.up.railway.app */
  BETTER_AUTH_URL: z.string().url().optional(),

  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
})

function loadEnv() {
  const parsed = envSchema.safeParse(process.env)

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n")
    throw new Error(`Invalid environment configuration:\n${issues}`)
  }

  return parsed.data
}

export const env = loadEnv()

export const isProduction = env.NODE_ENV === "production"
