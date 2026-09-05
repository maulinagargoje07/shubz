"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"

/**
 * Toasts.
 *
 * Sonner's shadcn wrapper normally reads the active theme through next-themes,
 * but this app has no theme switcher — it follows the OS. Driving the colours
 * from our own CSS variables instead drops that dependency entirely and keeps
 * toasts matching the palette in both schemes without any JavaScript deciding
 * which one is active.
 */
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      position="top-center"
      // Bottom-centre would sit under the phone tab bar; top-centre is also
      // where the eye already is after tapping Save.
      offset={16}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-popover group-[.toaster]:text-popover-foreground group-[.toaster]:border group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl",
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
