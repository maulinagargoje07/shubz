"use client"

import { cn } from "cn"

import {
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  defaultPermissionsFor,
  type Permission,
  type Role,
} from "@/lib/permissions"

/**
 * Permission toggles.
 *
 * Two modes, because "use the role's defaults" and "this exact set" are
 * genuinely different intents and conflating them is how permissions rot: a
 * user pinned to a copy of ADMIN's defaults silently stops tracking ADMIN when
 * that role later changes.
 *
 * `null` = follow the role. An array = exactly these, regardless of role.
 */
export function PermissionPicker({
  role,
  value,
  onChange,
  disabled,
}: {
  role: Role
  value: Permission[] | null
  onChange: (next: Permission[] | null) => void
  disabled?: boolean
}) {
  const defaults = defaultPermissionsFor(role)
  const usingDefaults = value === null
  const effective = usingDefaults ? defaults : value

  // A superadmin always holds everything; offering toggles would imply
  // otherwise and the server ignores them anyway.
  if (role === "SUPERADMIN") {
    return (
      <p className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
        A superadmin has every permission. These cannot be narrowed — it is the
        account that has to be able to fix everything else.
      </p>
    )
  }

  function toggle(permission: Permission) {
    const current = usingDefaults ? defaults : value
    const next = current.includes(permission)
      ? current.filter((p) => p !== permission)
      : [...current, permission]
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-secondary/40 px-3 py-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {usingDefaults ? "Using role defaults" : "Custom permissions"}
          </p>
          <p className="text-xs text-muted-foreground">
            {usingDefaults
              ? `Follows the ${role.toLowerCase()} role, including future changes to it.`
              : "Pinned to exactly what is ticked below."}
          </p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(usingDefaults ? [...defaults] : null)}
          className="shrink-0 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-secondary disabled:opacity-50"
        >
          {usingDefaults ? "Customise" : "Reset to defaults"}
        </button>
      </div>

      <div
        className={cn(
          "space-y-3 transition-opacity",
          usingDefaults && "pointer-events-none opacity-60"
        )}
      >
        {PERMISSION_GROUPS.map((group) => (
          <fieldset key={group.heading}>
            <legend className="mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground/80">
              {group.heading}
            </legend>
            <div className="grid gap-1.5">
              {group.permissions.map((permission) => {
                const checked = effective.includes(permission)
                const isDefault = defaults.includes(permission)

                return (
                  <label
                    key={permission}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors",
                      checked
                        ? "border-primary/30 bg-primary/10"
                        : "border-border/70 hover:bg-secondary/50"
                    )}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      disabled={disabled || usingDefaults}
                      onChange={() => toggle(permission)}
                    />
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded border-2 text-[10px] font-bold transition-colors",
                        checked
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/40"
                      )}
                    >
                      {checked ? "✓" : ""}
                    </span>
                    <span className="min-w-0 flex-1">
                      {PERMISSION_LABELS[permission]}
                    </span>
                    {isDefault ? (
                      <span className="shrink-0 text-[0.625rem] uppercase tracking-wide text-muted-foreground">
                        default
                      </span>
                    ) : null}
                  </label>
                )
              })}
            </div>
          </fieldset>
        ))}
      </div>
    </div>
  )
}
