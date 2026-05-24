"use client"

import type { ScenarioRow, Classification } from "@/lib/cogs-engine"

const BADGE: Record<Classification, string> = {
  WINNER:
    "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 ring-1 ring-emerald-200 dark:ring-emerald-800/60",
  BORDERLINE:
    "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-800/60",
  LOSER:
    "bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 ring-1 ring-red-200 dark:ring-red-800/60",
}

const BADGE_LABEL: Record<Classification, string> = {
  WINNER: "Profitable",
  BORDERLINE: "Borderline",
  LOSER: "Loss",
}

export function ScenarioTable({
  rows,
  currentCogs,
}: {
  rows: ScenarioRow[]
  currentCogs: number
}) {
  return (
    <section className="rounded-xl border border-insight-border dark:border-night-800 bg-white dark:bg-night-900 p-3.5 shadow-sm dark:shadow-none">
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-stone-500 dark:text-night-500">
        Vendor cost scenarios
      </h3>
      <div className="divide-y divide-stone-200 dark:divide-night-800">
        {rows.map((row) => {
          const isCurrent = Math.round(row.vendorCost) === Math.round(currentCogs)
          return (
            <div
              key={row.vendorCost}
              className={`grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 py-1.5 text-xs sm:gap-4 ${
                isCurrent ? "rounded-md bg-stone-50 dark:bg-night-850 -mx-1 px-1" : ""
              }`}
            >
              <span className="text-stone-700 dark:text-night-200">
                Vendor ₹{row.vendorCost.toLocaleString("en-IN")}
                {isCurrent && (
                  <span className="ml-1.5 text-[10px] text-stone-400 dark:text-night-600">current</span>
                )}
              </span>
              <span
                className={`text-right font-medium tabular-nums ${
                  row.profit < 0 ? "text-insight-negative" : "text-stone-900 dark:text-night-50"
                }`}
              >
                {row.profit < 0 ? "−" : ""}₹
                {Math.abs(Math.round(row.profit)).toLocaleString("en-IN")}/u
              </span>
              <span
                className={`w-12 text-right tabular-nums ${
                  row.marginPct < 0 ? "text-insight-negative" : "text-stone-500 dark:text-night-500"
                }`}
              >
                {row.marginPct.toFixed(1)}%
              </span>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${BADGE[row.badge]}`}
              >
                {BADGE_LABEL[row.badge]}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
