import type { Metadata, Viewport } from "next"

import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: "ShubzTrader",
    template: "%s · ShubzTrader",
  },
  description: "Student management and CRM for ShubzTrader",
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
  themeColor: "#050505",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(t==="light"){document.documentElement.classList.remove("dark");document.documentElement.classList.add("light");}else{document.documentElement.classList.add("dark");document.documentElement.classList.remove("light");}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-svh bg-background text-foreground selection:bg-primary/30 selection:text-primary">
        {children}
        <Toaster richColors theme="dark" />
      </body>
    </html>
  )
}
