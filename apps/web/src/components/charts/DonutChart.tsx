"use client"

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"
import { CHART_COLORS, fmtCurrency } from "./format"
import type { NamedValue } from "@/lib/dashboard/transforms"

interface Props {
  slices: NamedValue[]
}

export function DonutChart({ slices }: Props) {
  const data = slices.filter((s) => s.value > 0)
  if (!data.length) return <p className="text-sm text-slate-500">No data for this period.</p>

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={52}
          outerRadius={78}
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v: number) => fmtCurrency(v)}
          contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
