import type { Metadata } from "next"
import { Inter, Source_Serif_4 } from "next/font/google"
import "./globals.css"

import { Shell } from "@/components/layout/Shell"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Multi-Agent BI",
  description: "Business intelligence for Shopify + Ads",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${sourceSerif.variable}`}>
      <body>
        {/* Runs before first paint to prevent flash of wrong theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('seleric-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})()`,
          }}
        />
        <Shell>{children}</Shell>
      </body>
    </html>
  )
}
