"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const TABS = [
  { label: "Overview", href: "/control" },
  { label: "Approvals", href: "/control/approvals" },
  { label: "History", href: "/control/history" },
  { label: "Rules", href: "/control/rules" },
]

export default function ControlLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col min-h-full">
      <nav className="border-b border-stone-200 dark:border-night-800 bg-white dark:bg-night-900 px-6">
        <div className="flex gap-0">
          {TABS.map((tab) => {
            const active =
              tab.href === "/control"
                ? pathname === "/control"
                : pathname.startsWith(tab.href)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  active
                    ? "border-stone-900 dark:border-night-50 text-stone-900 dark:text-night-50"
                    : "border-transparent text-stone-500 dark:text-night-400 hover:text-stone-700 dark:hover:text-night-200"
                }`}
              >
                {tab.label}
              </Link>
            )
          })}
        </div>
      </nav>
      <div className="flex-1">{children}</div>
    </div>
  )
}
