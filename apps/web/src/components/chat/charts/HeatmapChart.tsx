"use client"

import { ChartShell } from "./ChartShell"
import { formatInr } from "@/lib/chat/visualization/format-inr"
import type { ChartPlan, NormalizedRow } from "@/lib/chat/visualization"

export function HeatmapChartView({ rows, plan }: { rows: NormalizedRow[]; plan: ChartPlan }) {
  const metric = plan.series[0]?.key
  const values = rows.map((r) => Number(r[metric ?? ""] ?? 0)).filter(isFinite)
  const max = Math.max(...values, 1)

  return (
    <ChartShell title={plan.title}>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(rows.length, 12)}, minmax(0, 1fr))` }}>
        {rows.map((row, i) => {
          const v = Number(row[metric ?? ""] ?? 0)
          const intensity = Math.min(1, Math.abs(v) / max)
          const bg =
            v >= 0
              ? `rgba(42, 157, 143, ${0.15 + intensity * 0.65})`
              : `rgba(229, 115, 115, ${0.15 + intensity * 0.65})`
          return (
            <div
              key={i}
              className="rounded p-2 text-center text-[10px] font-serif border border-insight-border"
              style={{ backgroundColor: bg }}
              title={formatInr(v)}
            >
              <div className="text-stone-500 truncate">{String(row[plan.xKey] ?? i)}</div>
              <div className="text-stone-800 font-medium">{formatInr(v)}</div>
            </div>
          )
        })}
      </div>
    </ChartShell>
  )
}
