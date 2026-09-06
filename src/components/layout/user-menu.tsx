"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { LogOut, Moon, ShieldCheck, Sun, UserRound } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { signOut } from "@/lib/auth-client"

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
}

export function UserMenu({
  name,
  email,
  role,
  canManageUsers = false,
}: {
  name: string
  email: string
  role: string
  canManageUsers?: boolean
}) {
  const router = useRouter()
  const [isDark, setIsDark] = useState(true)

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"))
  }, [])

  function toggleTheme() {
    const currentlyDark = document.documentElement.classList.contains("dark")
    if (currentlyDark) {
      document.documentElement.classList.remove("dark")
      document.documentElement.classList.add("light")
      localStorage.setItem("theme", "light")
      setIsDark(false)
    } else {
      document.documentElement.classList.remove("light")
      document.documentElement.classList.add("dark")
      localStorage.setItem("theme", "dark")
      setIsDark(true)
    }
  }

  async function handleSignOut() {
    await signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" className="h-9 gap-2 px-2 hover:bg-secondary">
            <Avatar className="size-7 ring-1 ring-primary/40">
              <AvatarFallback className="bg-primary/20 text-xs font-semibold text-primary">
                {initials(name)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium sm:inline">{name}</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56 border-border/70 bg-popover/95 backdrop-blur-md">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-foreground">{name}</span>
            <span className="truncate text-xs text-muted-foreground">{email}</span>
            <span className="mt-1 inline-flex w-fit items-center rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[0.625rem] font-medium uppercase tracking-wider text-primary">
              {role}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border/60" />
        <DropdownMenuItem
          render={<Link href="/settings/profile" />}
          className="cursor-pointer"
        >
          <UserRound className="size-4 text-primary" aria-hidden />
          <span>Your profile</span>
        </DropdownMenuItem>
        {canManageUsers ? (
          <DropdownMenuItem
            render={<Link href="/settings/team" />}
            className="cursor-pointer"
          >
            <ShieldCheck className="size-4 text-primary" aria-hidden />
            <span>Team</span>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator className="bg-border/60" />
        <DropdownMenuItem onClick={toggleTheme} className="cursor-pointer">
          {isDark ? (
            <>
              <Sun className="size-4 text-primary" aria-hidden />
              <span>Light mode</span>
            </>
          ) : (
            <>
              <Moon className="size-4 text-primary" aria-hidden />
              <span>Dark mode</span>
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-border/60" />
        <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive focus:text-destructive">
          <LogOut className="size-4" aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
