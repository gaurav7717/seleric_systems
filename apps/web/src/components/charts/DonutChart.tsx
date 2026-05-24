"use client"

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"
import { CHART_COLORS, fmtCurrency } from "./format"
import type { NamedValue } from "@/lib/dashboard/transforms"
import { useChartTheme } from "@/hooks/useChartTheme"

interface Props {
  slices: NamedValue[]
}

export function DonutChart({ slices }: Props) {
  const ct = useChartTheme()
  const data = slices.filter((s) => s.value > 0)
  if (!data.length) return <p className="text-sm text-slate-500 dark:text-night-500">No data for this period.</p>

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
          contentStyle={ct.tooltip}
        />
        <Legend wrapperStyle={ct.legend} />
      </PieChart>
    </ResponsiveContainer>
  )
}
