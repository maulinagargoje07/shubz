import { CheckCircle2, Mail, ShieldCheck } from "lucide-react"

import { PageHeader, SectionHeading } from "@/components/page-header"
import { StatusPill } from "@/components/ui/status"
import { formatIST } from "@/lib/fy"
import {
  PERMISSION_LABELS,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  defaultPermissionsFor,
} from "@/lib/permissions"
import { requireUser } from "@/lib/session"
import { db } from "@/db"
import { users } from "@/db/schema"
import { eq } from "drizzle-orm"
import { ChangePasswordForm, EditNameForm, SignOutButton } from "./profile-forms"

export const dynamic = "force-dynamic"
export const metadata = { title: "Your profile" }

export default async function ProfilePage() {
  const user = await requireUser()

  const [row] = await db
    .select({ createdAt: users.createdAt, permissions: users.permissions })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1)

  const usingDefaults = row?.permissions == null
  const roleDefaults = defaultPermissionsFor(user.role)

  return (
    <div className="pb-8">
      <PageHeader
        title="Your profile"
        description="Your account, and what it can do."
        actions={<SignOutButton />}
      />

      <div className="grid gap-6 px-4 py-4 sm:px-6 lg:grid-cols-2">
        <section className="space-y-6">
          <div>
            <SectionHeading>Account</SectionHeading>
            <dl className="grid gap-3 rounded-xl border border-border/80 bg-card p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Email</dt>
                <dd className="inline-flex min-w-0 items-center gap-1.5">
                  <Mail className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="truncate">{user.email}</span>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Role</dt>
                <dd>
                  <StatusPill tone="info">{ROLE_LABELS[user.role]}</StatusPill>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <StatusPill tone="paid">Active</StatusPill>
                </dd>
              </div>
              {row?.createdAt ? (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Member since</dt>
                  <dd>{formatIST(row.createdAt, "d MMM yyyy")}</dd>
                </div>
              ) : null}
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">
              {/* Email and role are not editable here on purpose. */}
              Your email and role are managed by a superadmin. Ask them if either
              needs changing.
            </p>
          </div>

          <div>
            <SectionHeading>Display name</SectionHeading>
            <div className="rounded-xl border border-border/80 bg-card p-4">
              <EditNameForm name={user.name} />
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div>
            <SectionHeading>Password</SectionHeading>
            <div className="rounded-xl border border-border/80 bg-card p-4">
              <ChangePasswordForm />
            </div>
          </div>

          <div>
            <SectionHeading>What you can do</SectionHeading>
            <div className="rounded-xl border border-border/80 bg-card p-4">
              <p className="mb-3 flex items-start gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <span>
                  {ROLE_DESCRIPTIONS[user.role]}{" "}
                  {user.role === "SUPERADMIN"
                    ? ""
                    : usingDefaults
                      ? "These are the standard permissions for your role."
                      : "A superadmin has customised these for you."}
                </span>
              </p>

              {user.permissions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No permissions assigned yet. Ask a superadmin for access.
                </p>
              ) : (
                <ul className="grid gap-1.5">
                  {user.permissions.map((permission) => (
                    <li key={permission} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="size-3.5 shrink-0 text-paid" aria-hidden />
                      <span className="min-w-0 flex-1">{PERMISSION_LABELS[permission]}</span>
                      {!usingDefaults && !roleDefaults.includes(permission) ? (
                        <span className="shrink-0 text-[0.625rem] uppercase tracking-wide text-primary">
                          extra
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
