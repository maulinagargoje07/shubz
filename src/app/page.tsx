import { redirect } from "next/navigation"

import { getSessionUser } from "@/lib/session"

/**
 * Every page in this app is per-user and reads a session cookie, so nothing
 * here can be prerendered at build time.
 */
export const dynamic = "force-dynamic"

export default async function RootPage() {
  redirect((await getSessionUser()) ? "/dashboard" : "/login")
}
