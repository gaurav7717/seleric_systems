"use client"

import type { ReactNode } from "react"

export function ChartShell({
  title,
  children,
  className = "",
}: {
  title?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-xl bg-insight-canvas border border-insight-border p-4 my-3 ${className}`}>
      {title && (
        <h4 className="text-[10px] font-semibold uppercase tracking-widest text-stone-500 mb-3 font-sans">
          {title}
        </h4>
      )}
      {children}
    </div>
  )
}
