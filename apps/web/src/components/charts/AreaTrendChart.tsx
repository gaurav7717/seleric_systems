"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  detectDateKey,
  detectNumericKeys,
  fmtPct,
  isPctMetric,
  prettyLabel,
  shortDate,
} from "./format"

interface Props {
  rows: Record<string, unknown>[]
}

export function AreaTrendChart({ rows }: Props) {
  if (!rows?.length) return <p className="text-sm text-slate-500">No data for this period.</p>

  const dateKey = detectDateKey(rows)
  const numericKeys = detectNumericKeys(rows, dateKey ? [dateKey] : [])
  const measureKey = numericKeys[0]
  if (!dateKey || !measureKey) {
    return <p className="text-sm text-slate-500">Cannot render chart — unexpected data shape.</p>
  }

  const sorted = [...rows].sort((a, b) => String(a[dateKey]).localeCompare(String(b[dateKey])))
  const label = prettyLabel(measureKey)
  const pct = isPctMetric(measureKey)
  const data = sorted.map((r) => ({
    date: shortDate(String(r[dateKey] ?? "")),
    [label]: Number(r[measureKey] ?? 0),
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#34d399" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis
          tickFormatter={pct ? fmtPct : (v) => String(v)}
          tick={{ fill: "#94a3b8", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={48}
        />
        <Tooltip
          formatter={(v: number) => (pct ? fmtPct(v) : v.toFixed(2))}
          contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
        />
        <Area type="monotone" dataKey={label} stroke="#34d399" fill="url(#areaFill)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
