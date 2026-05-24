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
    <div className={`rounded-xl bg-insight-canvas dark:bg-night-900 border border-insight-border dark:border-night-800 p-4 my-3 ${className}`}>
      {title && (
        <h4 className="text-[10px] font-semibold uppercase tracking-widest text-stone-500 dark:text-night-500 mb-3 font-sans">
          {title}
        </h4>
      )}
      {children}
    </div>
  )
}
