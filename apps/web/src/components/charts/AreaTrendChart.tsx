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
  timeAxisMinTickGap,
  timeAxisTickInterval,
} from "./format"
import { useChartTheme } from "@/hooks/useChartTheme"

interface Props {
  rows: Record<string, unknown>[]
}

export function AreaTrendChart({ rows }: Props) {
  if (!rows?.length) return <p className="text-sm text-stone-500 dark:text-night-500">No data for this period.</p>

  const dateKey = detectDateKey(rows)
  const numericKeys = detectNumericKeys(rows, dateKey ? [dateKey] : [])
  const measureKey = numericKeys[0]
  if (!dateKey || !measureKey) {
    return (
      <p className="text-sm text-stone-500 dark:text-night-500">Cannot render chart — unexpected data shape.</p>
    )
  }

  const ct = useChartTheme()
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
          tickFormatter={pct ? fmtPct : (v) => String(v)}
          tick={{ fill: ct.tick, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={48}
        />
        <Tooltip
          formatter={(v: number) => (pct ? fmtPct(v) : v.toFixed(2))}
          contentStyle={ct.tooltip}
        />
        <Area type="monotone" dataKey={label} stroke="#34d399" fill="url(#areaFill)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
