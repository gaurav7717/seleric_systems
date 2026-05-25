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
import {
  CHART_COLORS,
  detectDateKey,
  detectNumericKeys,
  fmtCount,
  fmtCurrency,
  isCountMetric,
  prettyLabel,
  shortDate,
  timeAxisMinTickGap,
  timeAxisTickInterval,
} from "./format"
import { useChartTheme } from "@/hooks/useChartTheme"

interface Props {
  rows: Record<string, unknown>[]
}

export function GroupedBarChart({ rows }: Props) {
  if (!rows?.length) return <p className="text-sm text-stone-500 dark:text-night-500">No data for this period.</p>

  const dateKey = detectDateKey(rows)
  const numericKeys = detectNumericKeys(rows, dateKey ? [dateKey] : [])
  if (!dateKey || !numericKeys.length) {
    return (
      <p className="text-sm text-stone-500 dark:text-night-500">Cannot render chart — unexpected data shape.</p>
    )
  }

  const sorted = [...rows].sort((a, b) => String(a[dateKey]).localeCompare(String(b[dateKey])))
  const data = sorted.map((r) => {
    const point: Record<string, unknown> = { date: shortDate(String(r[dateKey] ?? "")) }
    for (const k of numericKeys.slice(0, 4)) {
      point[prettyLabel(k)] = Number(r[k] ?? 0)
    }
    return point
  })

  const ct = useChartTheme()
  const labels = numericKeys.slice(0, 4).map(prettyLabel)
  const useCount = numericKeys.every((k) => isCountMetric(k))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
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
          tickFormatter={useCount ? fmtCount : fmtCurrency}
          tick={{ fill: ct.tick, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={62}
        />
        <Tooltip
          contentStyle={ct.tooltip}
          formatter={(v: number, name: string) => [useCount ? fmtCount(v) : fmtCurrency(v), name]}
        />
        <Legend wrapperStyle={ct.legend} />
        {labels.map((label, i) => (
          <Bar key={label} dataKey={label} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[3, 3, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
