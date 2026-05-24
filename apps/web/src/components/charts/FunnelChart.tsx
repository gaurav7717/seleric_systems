"use client"

import { CHART_COLORS, fmtCount } from "./format"
import type { NamedValue } from "@/lib/dashboard/transforms"

interface Props {
  steps: NamedValue[]
}

export function FunnelChart({ steps }: Props) {
  const data = steps.filter((s) => s.value >= 0)
  if (!data.length) return <p className="text-sm text-slate-500">No funnel data.</p>

  const max = Math.max(...data.map((s) => s.value), 1)

  return (
    <div className="flex flex-col gap-2 py-1">
      {data.map((step, i) => {
        const pct = max > 0 ? (step.value / max) * 100 : 0
        const conv =
          i > 0 && data[i - 1].value > 0
            ? ((step.value / data[i - 1].value) * 100).toFixed(1)
            : null
        return (
          <div key={step.name} className="flex flex-col gap-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">{step.name}</span>
              <span className="text-slate-400">
                {fmtCount(step.value)}
                {conv != null && <span className="text-slate-600 ml-2">({conv}%)</span>}
              </span>
            </div>
            <div className="h-7 rounded-md bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-md transition-all"
                style={{
                  width: `${Math.max(pct, 4)}%`,
                  backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
