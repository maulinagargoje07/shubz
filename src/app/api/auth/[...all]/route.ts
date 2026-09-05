/** Better Auth's HTTP endpoints: sign-in, sign-out, session. */

import { toNextJsHandler } from "better-auth/next-js"

import { auth } from "@/lib/auth"

export const { GET, POST } = toNextJsHandler(auth)
