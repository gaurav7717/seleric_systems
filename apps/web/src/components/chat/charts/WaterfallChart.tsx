"use client"

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts"
import { ChartShell } from "./ChartShell"
import { formatInr } from "@/lib/chat/visualization/format-inr"
import type { ChartPlan, NormalizedRow } from "@/lib/chat/visualization"

const GRID = "#E8E5DC"

export function WaterfallChartView({ rows, plan }: { rows: NormalizedRow[]; plan: ChartPlan }) {
  const row = rows[0] ?? {}
  const data = plan.series.map((s) => ({
    name: s.label,
    value: Number(row[s.key] ?? 0),
  }))

  return (
    <ChartShell title={plan.title ?? "Bridge"}>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis dataKey="name" tick={{ fill: "#6B7280", fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
          <YAxis tickFormatter={(v) => formatInr(v)} tick={{ fill: "#6B7280", fontSize: 11 }} width={64} />
          <Tooltip formatter={(v: number) => formatInr(v)} />
          <Bar dataKey="value" radius={[2, 2, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.value >= 0 ? "#2A9D8F" : "#E57373"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  )
}
