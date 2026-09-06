"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { KeyRound, Pencil, Power, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  type FormContext,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  assignableRoles,
  type Permission,
  type Role,
} from "@/lib/permissions"
import {
  MIN_PASSWORD_LENGTH,
  createTeamMemberSchema,
  resetTeamMemberPasswordSchema,
  updateTeamMemberSchema,
  type CreateTeamMemberParsed,
  type CreateTeamMemberValues,
  type ResetPasswordValues,
  type UpdateTeamMemberParsed,
  type UpdateTeamMemberValues,
} from "@/lib/validation/team"
import {
  createTeamMember,
  resetTeamMemberPassword,
  setTeamMemberStatus,
  updateTeamMember,
} from "@/server/team/actions"
import { PermissionPicker } from "./permission-picker"

/** Radio-card role selector — four options, each needing a line of explanation. */
function RoleChoice({
  value,
  onChange,
  options,
  disabled,
}: {
  value: Role
  onChange: (role: Role) => void
  options: Role[]
  disabled?: boolean
}) {
  return (
    <div className="grid gap-2">
      {options.map((role) => {
        const selected = value === role
        return (
          <label
            key={role}
            className={cn(
              "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors",
              selected ? "border-primary bg-primary/10" : "border-border/70 hover:bg-secondary/50",
              disabled && "cursor-not-allowed opacity-60"
            )}
          >
            <input
              type="radio"
              className="sr-only"
              checked={selected}
              disabled={disabled}
              onChange={() => onChange(role)}
            />
            <span
              aria-hidden
              className={cn(
                "mt-0.5 size-4 shrink-0 rounded-full border-2 transition-colors",
                selected ? "border-primary bg-primary" : "border-muted-foreground/40"
              )}
            />
            <span className="min-w-0">
              <span className="block font-medium">{ROLE_LABELS[role]}</span>
              <span className="block text-xs text-muted-foreground">
                {ROLE_DESCRIPTIONS[role]}
              </span>
            </span>
          </label>
        )
      })}
    </div>
  )
}

// ------------------------------------------------------------------ create

export function AddTeamMemberDialog({ actorRole }: { actorRole: Role }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const options = assignableRoles(actorRole)

  const form = useForm<CreateTeamMemberValues, FormContext, CreateTeamMemberParsed>({
    resolver: zodResolver(createTeamMemberSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "OPERATOR",
      permissions: null,
    },
  })

  const role = form.watch("role") as Role
  const permissions = form.watch("permissions") as Permission[] | null

  async function onSubmit() {
    const result = await createTeamMember(form.getValues())

    if (!result.ok) {
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          form.setError(field as keyof CreateTeamMemberValues, { message })
        }
      }
      toast.error(result.error)
      return
    }

    toast.success("Team member added", {
      description: "Share the password with them and ask them to change it.",
    })
    form.reset()
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <UserPlus className="size-4" />
            Add team member
          </Button>
        }
      />
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add team member</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Ravi Kumar" autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        inputMode="email"
                        autoCapitalize="none"
                        autoCorrect="off"
                        autoComplete="off"
                        placeholder="ravi@shubztrader.in"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Initial password</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      autoComplete="new-password"
                      placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Shown in plain text so you can copy it once. They should change
                    it after signing in.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <RoleChoice
                    value={field.value as Role}
                    onChange={(r) => {
                      field.onChange(r)
                      // Switching role resets to that role's defaults; carrying
                      // the previous role's ticks across is never intended.
                      form.setValue("permissions", null)
                    }}
                    options={options}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            <div>
              <Label className="mb-2 block">Permissions</Label>
              <PermissionPicker
                role={role}
                value={permissions}
                onChange={(next) => form.setValue("permissions", next)}
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Adding…" : "Add team member"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

// -------------------------------------------------------------------- edit

export function EditTeamMemberDialog({
  member,
  actorRole,
  isSelf,
}: {
  member: {
    id: string
    name: string
    email: string
    role: Role
    overrides: Permission[] | null
  }
  actorRole: Role
  isSelf: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const options = assignableRoles(actorRole)

  const form = useForm<UpdateTeamMemberValues, FormContext, UpdateTeamMemberParsed>({
    resolver: zodResolver(updateTeamMemberSchema),
    defaultValues: {
      id: member.id,
      name: member.name,
      role: member.role,
      permissions: member.overrides,
    },
  })

  const role = form.watch("role") as Role
  const permissions = form.watch("permissions") as Permission[] | null

  async function onSubmit() {
    const result = await updateTeamMember(form.getValues())

    if (!result.ok) {
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          form.setError(field as keyof UpdateTeamMemberValues, { message })
        }
      }
      toast.error(result.error)
      return
    }

    toast.success("Team member updated")
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon" aria-label={`Edit ${member.name}`}>
            <Pencil className="size-4" />
          </Button>
        }
      />
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{member.name}</DialogTitle>
        </DialogHeader>
        <p className="-mt-2 text-sm text-muted-foreground">{member.email}</p>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  {isSelf ? (
                    <p className="rounded-lg border border-border/70 bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">
                      You cannot change your own role. Ask another superadmin.
                    </p>
                  ) : (
                    <RoleChoice
                      value={field.value as Role}
                      onChange={(r) => {
                        field.onChange(r)
                        form.setValue("permissions", null)
                      }}
                      options={options}
                    />
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <div>
              <Label className="mb-2 block">Permissions</Label>
              <PermissionPicker
                role={role}
                value={permissions}
                onChange={(next) => form.setValue("permissions", next)}
                disabled={isSelf}
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving…" : "Save changes"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

// ------------------------------------------------------------ reset password

export function ResetPasswordDialog({
  member,
}: {
  member: { id: string; name: string }
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetTeamMemberPasswordSchema),
    defaultValues: { id: member.id, password: "" },
  })

  async function onSubmit(values: ResetPasswordValues) {
    const result = await resetTeamMemberPassword(values)

    if (!result.ok) {
      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          form.setError(field as keyof ResetPasswordValues, { message })
        }
      }
      toast.error(result.error)
      return
    }

    toast.success("Password reset", { description: "Share the new one with them." })
    form.reset({ id: member.id, password: "" })
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Reset password for ${member.name}`}
          >
            <KeyRound className="size-4" />
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
        </DialogHeader>
        <p className="-mt-2 text-sm text-muted-foreground">
          Sets a new password for <strong className="text-foreground">{member.name}</strong>.
          Their existing sessions stay valid until they sign out.
        </p>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New password</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      autoComplete="new-password"
                      placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Resetting…" : "Reset password"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

// ------------------------------------------------------------ activate/off

export function ToggleStatusButton({
  member,
  isSelf,
}: {
  member: { id: string; name: string; active: boolean }
  isSelf: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function onToggle() {
    setBusy(true)
    const result = await setTeamMemberStatus({ id: member.id, active: !member.active })
    setBusy(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }

    toast.success(
      result.data.active
        ? `${member.name} can sign in again`
        : `${member.name} has been deactivated`
    )
    router.refresh()
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onToggle}
      // Deactivating yourself locks you out of the only account that can undo it.
      disabled={busy || isSelf}
      aria-label={
        isSelf
          ? "You cannot deactivate your own account"
          : member.active
            ? `Deactivate ${member.name}`
            : `Activate ${member.name}`
      }
      title={isSelf ? "You cannot deactivate your own account" : undefined}
      className={cn(member.active ? "text-muted-foreground hover:text-overdue" : "text-paid")}
    >
      <Power className="size-4" />
    </Button>
  )
}
