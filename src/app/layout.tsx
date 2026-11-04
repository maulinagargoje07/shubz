import type { Metadata, Viewport } from "next"

import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: "ShubzTrader",
    template: "%s · ShubzTrader",
  },
  description: "ShubzTrader indicator admin: subscribers, payments and TradingView access",
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
  // An internal tool has nothing to gain from being indexed.
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "ShubzTrader", statusBarStyle: "default" },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  // The browser chrome matches the wall behind the glass in either theme.
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0e1c" },
    { media: "(prefers-color-scheme: light)", color: "#f3f4f9" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/*
          Sets the theme class before first paint, from localStorage.theme:
          "light" and "dark" are themselves, "system" follows the OS, and
          nothing stored means dark. The user menu writes the same key. It has
          run by the time React hydrates, and some browser extensions empty
          inline scripts after they run, which React would report as a
          hydration mismatch on __html. suppressHydrationWarning skips that
          check for this element only.
        */}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");var d=t==="light"?false:t==="system"?window.matchMedia("(prefers-color-scheme: dark)").matches:true;var c=document.documentElement.classList;c.toggle("dark",d);c.toggle("light",!d);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-svh bg-background text-foreground selection:bg-primary/30 selection:text-primary">
        {children}
        <Toaster richColors />
      </body>
    </html>
  )
}
