import type { Metadata, Viewport } from "next"

import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: "ShubzTrader",
    template: "%s · ShubzTrader",
  },
  description: "Student management and CRM for ShubzTrader",
  // An internal tool has nothing to gain from being indexed.
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "ShubzTrader", statusBarStyle: "default" },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Never block zoom: pinching a fee table is a legitimate thing to do, and
  // disabling it is an accessibility failure.
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#16181f" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {children}
        <Toaster richColors />
      </body>
    </html>
  )
}
