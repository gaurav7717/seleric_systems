"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  CHART_COLORS,
  detectDateKey,
  fmtCurrency,
  shortDate,
  timeAxisMinTickGap,
  timeAxisTickInterval,
} from "./format"
import { useChartTheme } from "@/hooks/useChartTheme"

interface SeriesDef {
  label: string
  measure: string
}

interface Props {
  rows: Record<string, unknown>[]
  series: SeriesDef[]
}

export function StackedAreaChart({ rows, series }: Props) {
  if (!rows?.length) return <p className="text-sm text-slate-500">No data for this period.</p>

  const dateKey = detectDateKey(rows)
  if (!dateKey) return <p className="text-sm text-slate-500">Cannot render chart — no date dimension.</p>

  const sorted = [...rows].sort((a, b) => String(a[dateKey]).localeCompare(String(b[dateKey])))
  const data = sorted.map((r) => {
    const point: Record<string, unknown> = { date: shortDate(String(r[dateKey] ?? "")) }
    for (const { label, measure } of series) {
      point[label] = Number(r[measure] ?? 0)
    }
    return point
  })

  const ct = useChartTheme()

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
        <XAxis
          dataKey="date"
          tick={{ fill: ct.tick, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          interval={timeAxisTickInterval(data.length)}
          minTickGap={timeAxisMinTickGap(data.length)}
        />
        <YAxis
          tickFormatter={fmtCurrency}
          tick={{ fill: ct.tick, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={62}
        />
        <Tooltip
          formatter={(v: number) => fmtCurrency(v)}
          contentStyle={ct.tooltip}
        />
        <Legend wrapperStyle={ct.legend} />
        {series.map(({ label }, i) => (
          <Area
            key={label}
            type="monotone"
            dataKey={label}
            stackId="stack"
            stroke={CHART_COLORS[i % CHART_COLORS.length]}
            fill={CHART_COLORS[i % CHART_COLORS.length]}
            fillOpacity={0.35}
            strokeWidth={2}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}
