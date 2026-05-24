"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { CHART_COLORS, fmtCurrency, prettyLabel } from "./format"

interface Props {
  rows: Record<string, unknown>[]
  labelKey: string
  measureKeys: string[]
  height?: number
}

export function HorizontalBarChart({ rows, labelKey, measureKeys, height = 280 }: Props) {
  if (!rows?.length) return <p className="text-sm text-slate-500">No data for this period.</p>

  const data = rows.map((r) => {
    const point: Record<string, unknown> = {
      label: String(r[labelKey] ?? "—").slice(0, 40),
    }
    for (const k of measureKeys) {
      point[prettyLabel(k)] = Number(r[k] ?? 0)
    }
    return point
  })

  const labels = measureKeys.map(prettyLabel)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
        <XAxis type="number" tickFormatter={fmtCurrency} tick={{ fill: "#94a3b8", fontSize: 10 }} />
        <YAxis
          type="category"
          dataKey="label"
          width={120}
          tick={{ fill: "#94a3b8", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          formatter={(v: number) => fmtCurrency(v)}
          contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
        />
        {labels.length > 1 && <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />}
        {labels.map((label, i) => (
          <Bar key={label} dataKey={label} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[0, 4, 4, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
