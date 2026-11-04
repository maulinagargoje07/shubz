"use client"

import { useEffect, useState } from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

import "./sonner.css"

/**
 * Toasts.
 *
 * Sonner's shadcn wrapper normally reads the active theme through next-themes,
 * which this app does not have: the theme is the class on <html>, set before
 * paint by the inline script in app/layout.tsx and switched by the user menu.
 * So the toaster watches that class and tells Sonner which theme it is in.
 * The surface itself is regular glass (sonner.css hands it over; see there).
 */
type Theme = "light" | "dark"

function readTheme(): Theme {
  return document.documentElement.classList.contains("light") ? "light" : "dark"
}

export function Toaster(props: ToasterProps) {
  // Dark on the server and until the first effect, which is what the page
  // itself defaults to, so nothing flips during hydration.
  const [theme, setTheme] = useState<Theme>("dark")

  useEffect(() => {
    const sync = () => setTheme(readTheme())
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])

  return (
    <Sonner
      className="toaster group"
      theme={theme}
      position="top-center"
      // Bottom-centre would sit under the phone tab bar; top-centre is also
      // where the eye already is after tapping Save.
      offset={16}
      toastOptions={{
        classNames: {
          toast: "group toast glass glass-regular rounded-2xl text-popover-foreground",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          error: "group-[.toaster]:text-overdue-foreground",
          success: "group-[.toaster]:text-paid-foreground",
        },
      }}
      {...props}
    />
  )
}
