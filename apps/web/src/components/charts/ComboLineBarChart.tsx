"use client"

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  CHART_COLORS,
  detectDateKey,
  detectNumericKeys,
  formatAxisTick,
  formatMeasureValue,
  isCountMetric,
  isPctMetric,
  measureFormat,
  prettyLabel,
  shortDate,
} from "./format"
import { useChartTheme } from "@/hooks/useChartTheme"

interface Props {
  rows: Record<string, unknown>[]
  barMeasures?: string[]
  lineMeasures?: string[]
}

export function ComboLineBarChart({ rows, barMeasures, lineMeasures }: Props) {
  if (!rows?.length) return <p className="text-sm text-stone-500 dark:text-night-500">No data for this period.</p>

  const dateKey = detectDateKey(rows)
  const numericKeys = detectNumericKeys(rows, dateKey ? [dateKey] : [])
  if (!dateKey || !numericKeys.length) {
    return (
      <p className="text-sm text-stone-500 dark:text-night-500">Cannot render chart — unexpected data shape.</p>
    )
  }

  const bars = barMeasures ?? numericKeys.filter((k) => isCountMetric(k)).slice(0, 2)
  const lines = lineMeasures ?? numericKeys.filter((k) => !bars.includes(k)).slice(0, 2)
  if (!bars.length && !lines.length) {
    return <p className="text-sm text-stone-500 dark:text-night-500">Cannot render chart — no measures.</p>
  }

  const sorted = [...rows].sort((a, b) => String(a[dateKey]).localeCompare(String(b[dateKey])))
  const data = sorted.map((r) => {
    const point: Record<string, unknown> = { date: shortDate(String(r[dateKey] ?? "")) }
    for (const k of [...bars, ...lines]) {
      point[prettyLabel(k)] = Number(r[k] ?? 0)
    }
    return point
  })

  const barLabels = bars.map(prettyLabel)
  const lineLabels = lines.map(prettyLabel)
  const lineFormats = lines.map(measureFormat)
  const barFormats = bars.map(measureFormat)
  const lineIsPct = lines.some((k) => isPctMetric(k))

  const ct = useChartTheme()

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 4, right: 48, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
        <XAxis dataKey="date" tick={{ fill: ct.tick, fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis
          yAxisId="left"
          tickFormatter={(v) =>
            lineIsPct ? `${(Number(v) * 100).toFixed(1)}%` : formatAxisTick(v, lineFormats)
          }
          tick={{ fill: ct.tick, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={62}
        />
        {bars.length > 0 && (
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={(v) => formatAxisTick(v, barFormats)}
            tick={{ fill: ct.tick, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={52}
          />
        )}
        <Tooltip
          contentStyle={ct.tooltip}
          formatter={(v: number, name: string) => {
            const raw = [...bars, ...lines].find((k) => prettyLabel(k) === name) ?? name
            return [formatMeasureValue(v, raw), name]
          }}
        />
        <Legend wrapperStyle={ct.legend} />
        {barLabels.map((label, i) => (
          <Bar
            key={label}
            yAxisId={bars.length && lineLabels.length ? "right" : "left"}
            dataKey={label}
            fill={CHART_COLORS[i % CHART_COLORS.length]}
            radius={[3, 3, 0, 0]}
            opacity={0.85}
          />
        ))}
        {lineLabels.map((label, i) => (
          <Line
            key={label}
            yAxisId="left"
            type="monotone"
            dataKey={label}
            stroke={CHART_COLORS[(barLabels.length + i) % CHART_COLORS.length]}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
