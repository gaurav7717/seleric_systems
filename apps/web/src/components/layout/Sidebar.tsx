"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/insights", label: "Insights" },
  { href: "/ads", label: "Ads" },
  { href: "/shopify", label: "Shopify" },
  { href: "/chat", label: "Chat" },
  { href: "/control", label: "Control" },
  { href: "/tools", label: "Tools" },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 border-r border-stone-200 bg-white p-4 shrink-0">
      <p className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-4 px-2">Navigation</p>
      <nav className="flex flex-col gap-0.5 text-sm">
        {links.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`)
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-3 py-2 transition-colors ${
                active
                  ? "bg-stone-100 text-stone-900 font-medium"
                  : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
              }`}
            >
              {link.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
