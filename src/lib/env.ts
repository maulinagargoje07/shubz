/**
 * Environment configuration, validated on first use.
 *
 * Validation is LAZY, not eager at module load. `next build` imports every
 * route module to collect page data, so eager validation would make a
 * production build require production secrets — and it would fail on a CI
 * machine that legitimately has none. Instead the first actual read of a
 * config value validates the whole set and throws with a clear message, so a
 * misconfigured deployment still fails loudly on its first request rather than
 * silently connecting to nothing.
 *
 * Server-only. Nothing here may be imported into a client component.
 * Non-NEXT_PUBLIC_ variables are not inlined into client bundles, so a stray
 * import fails rather than leaking a secret, but the rule stands.
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

export type Env = z.infer<typeof envSchema>

let cached: Env | undefined

function loadEnv(): Env {
  if (cached) return cached

  const parsed = envSchema.safeParse(process.env)

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n")
    throw new Error(
      `Invalid environment configuration:\n${issues}\n\n` +
        `Copy .env.example to .env and fill it in. See README.md.`
    )
  }

  cached = parsed.data
  return cached
}

/**
 * Reads validate the whole environment on first access, then serve from cache.
 */
export const env = new Proxy({} as Env, {
  get(_target, prop: string) {
    return loadEnv()[prop as keyof Env]
  },
  has(_target, prop: string) {
    return prop in loadEnv()
  },
  ownKeys() {
    return Reflect.ownKeys(loadEnv())
  },
  getOwnPropertyDescriptor(_target, prop) {
    return Object.getOwnPropertyDescriptor(loadEnv(), prop)
  },
})

export function isProduction(): boolean {
  return loadEnv().NODE_ENV === "production"
}
