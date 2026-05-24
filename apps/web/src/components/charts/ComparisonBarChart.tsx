"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { CHART_COLORS, fmtCurrency } from "./format"
import type { NamedValue } from "@/lib/dashboard/transforms"

interface Props {
  items: NamedValue[]
}

/** Single-period bar comparison (e.g. attribution vs spend). */
export function ComparisonBarChart({ items }: Props) {
  if (!items.length) return <p className="text-sm text-slate-500">No data for this period.</p>

  const data = items.map((item) => ({ name: item.name, value: item.value }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis
          dataKey="name"
          tick={{ fill: "#94a3b8", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          interval={0}
          angle={-20}
          textAnchor="end"
          height={56}
        />
        <YAxis
          tickFormatter={fmtCurrency}
          tick={{ fill: "#94a3b8", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={62}
        />
        <Tooltip
          formatter={(v: number) => fmtCurrency(v)}
          contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
        />
        <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} name="Amount" />
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Hourly spend heatmap-style bars. */
export function HourlyBarChart({
  rows,
  labelKey,
  measureKey,
}: {
  rows: Record<string, unknown>[]
  labelKey: string
  measureKey: string
}) {
  if (!rows.length) return <p className="text-sm text-slate-500">No hourly data.</p>

  const data = rows.map((r) => ({
    hour: String(r[labelKey] ?? ""),
    value: Number(r[measureKey] ?? 0),
  }))
  const max = Math.max(...data.map((d) => d.value), 1)

  return (
    <div className="flex items-end gap-0.5 h-[200px] pt-2">
      {data.map((d) => (
        <div key={d.hour} className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <div
            className="w-full rounded-t bg-orange-500/80 min-h-[4px]"
            style={{ height: `${Math.max((d.value / max) * 160, 4)}px` }}
            title={`${d.hour}: ${fmtCurrency(d.value)}`}
          />
          <span className="text-[9px] text-slate-600 truncate w-full text-center">{d.hour}</span>
        </div>
      ))}
    </div>
  )
}
