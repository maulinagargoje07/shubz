"use client"

/**
 * Browser-side auth. Only the login form and the user menu use this;
 * everything else reads the session on the server.
 */

import { createAuthClient } from "better-auth/react"
import { inferAdditionalFields } from "better-auth/client/plugins"

import type { Auth } from "@/lib/auth"

export const authClient = createAuthClient({
  // Same origin in every environment, so no baseURL is needed.
  plugins: [inferAdditionalFields<Auth>()],
})

export const { signIn, signOut, useSession } = authClient
