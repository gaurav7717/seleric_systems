"use client"

import type { ChartPlan, NormalizedRow } from "@/lib/chat/visualization"
import { ChartRenderer } from "../charts/ChartRenderer"

export function MultiChartLayout({
  plans,
  rows,
}: {
  plans: ChartPlan[]
  rows: NormalizedRow[]
}) {
  const filtered = plans.filter((p) => p.kind !== "summary_kpi")

  return (
    <div className="space-y-1">
      {filtered.map((plan, i) => (
        <ChartRenderer key={`${plan.kind}-${i}`} plan={plan} rows={rows} />
      ))}
    </div>
  )
}
