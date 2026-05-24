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
  formatAxisTick,
  formatMeasureValue,
  measureFormat,
  prettyLabel,
} from "./format"
import { useChartTheme } from "@/hooks/useChartTheme"

interface Props {
  rows: Record<string, unknown>[]
  labelKey: string
  measureKeys: string[]
  height?: number
}

export function HorizontalBarChart({ rows, labelKey, measureKeys, height = 280 }: Props) {
  if (!rows?.length) return <p className="text-sm text-stone-500 dark:text-night-500">No data for this period.</p>

  const data = rows.map((r) => {
    const point: Record<string, unknown> = {
      label: String(r[labelKey] ?? "—").slice(0, 40),
    }
    for (const k of measureKeys) {
      point[prettyLabel(k)] = Number(r[k] ?? 0)
    }
    return point
  })

  const ct = useChartTheme()
  const labels = measureKeys.map(prettyLabel)
  const formats = measureKeys.map(measureFormat)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(v) => formatAxisTick(v, formats)}
          tick={{ fill: ct.tick, fontSize: 10 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={128}
          tick={{ fill: ct.tick, fontSize: 10 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          formatter={(v: number, name: string) => {
            const key = measureKeys.find((k) => prettyLabel(k) === name) ?? measureKeys[0]
            return [formatMeasureValue(v, key), name]
          }}
          contentStyle={ct.tooltip}
        />
        {labels.length > 1 && <Legend wrapperStyle={ct.legend} />}
        {labels.map((label, i) => (
          <Bar key={label} dataKey={label} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[0, 4, 4, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
