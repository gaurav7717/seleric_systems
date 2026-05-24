"use client"

import { fmtCount, fmtCurrency } from "./format"

interface Props {
  rows: Record<string, unknown>[]
  labelKey: string
  valueKey: string
  countKey?: string
}

export function RankedList({ rows, labelKey, valueKey, countKey }: Props) {
  if (!rows?.length) return <p className="text-sm text-slate-500">No data for this period.</p>

  const max = Math.max(...rows.map((r) => Number(r[valueKey] ?? 0)), 1)

  return (
    <ul className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
      {rows.map((r, i) => {
        const val = Number(r[valueKey] ?? 0)
        const pct = (val / max) * 100
        const label = String(r[labelKey] ?? "—")
        const count = countKey ? Number(r[countKey] ?? 0) : null
        return (
          <li key={`${label}-${i}`} className="text-xs">
            <div className="flex justify-between text-slate-300 mb-1 gap-2">
              <span className="truncate">{label}</span>
              <span className="text-slate-400 shrink-0">{fmtCurrency(val)}</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500/80" style={{ width: `${pct}%` }} />
            </div>
            {count != null && countKey && (
              <span className="text-slate-600 mt-0.5 block">{fmtCount(count)} orders</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
