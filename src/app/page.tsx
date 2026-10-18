import { redirect } from "next/navigation"

import { homePathFor } from "@/lib/permissions"
import { getSessionUser } from "@/lib/session"

/**
 * Every page in this app is per-user and reads a session cookie, so nothing
 * here can be prerendered at build time.
 */
export const dynamic = "force-dynamic"

export default async function RootPage() {
  const user = await getSessionUser()
  redirect(user ? homePathFor(user) : "/login")
}
