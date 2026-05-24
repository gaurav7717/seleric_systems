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
  fmtCurrency,
  prettyLabel,
  shortDate,
} from "./format"
import { useChartTheme } from "@/hooks/useChartTheme"

interface Props {
  rows: Record<string, unknown>[]
  /** Optional fixed series labels → measure keys on each row */
  series?: { label: string; measure: string }[]
  /** Category dimension when rows are not time-series (e.g. product_title) */
  categoryKey?: string
}

function detectCategoryKey(rows: Record<string, unknown>[]): string | null {
  if (!rows.length) return null
  const keys = Object.keys(rows[0])
  return keys.find((k) => /product_title|campaign_name|adset_name|sku|title|name|status|source|hourly/i.test(k)) ?? null
}

export function StackedBarChart({ rows, series, categoryKey }: Props) {
  if (!rows?.length) return <p className="text-sm text-stone-500 dark:text-night-500">No data for this period.</p>

  const dateKey = detectDateKey(rows)
  const catKey = categoryKey ?? (dateKey ? null : detectCategoryKey(rows))
  const xKey = dateKey ?? catKey
  if (!xKey) return <p className="text-sm text-stone-500 dark:text-night-500">Cannot render chart — no category dimension.</p>

  const defs =
    series ??
    detectNumericKeys(rows, [xKey]).slice(0, 4).map((m) => ({ label: prettyLabel(m), measure: m }))

  const sorted = dateKey
    ? [...rows].sort((a, b) => String(a[xKey]).localeCompare(String(b[xKey])))
    : rows.slice(0, 12)

  const data = sorted.map((r) => {
    const raw = String(r[xKey] ?? "")
    const point: Record<string, unknown> = {
      date: dateKey ? shortDate(raw) : raw.slice(0, 28),
    }
    for (const { label, measure } of defs) {
      point[label] = Number(r[measure] ?? 0)
    }
    return point
  })

  const ct = useChartTheme()

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
        <XAxis dataKey="date" tick={{ fill: ct.tick, fontSize: 11 }} tickLine={false} axisLine={false} />
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
        {defs.map(({ label }, i) => (
          <Bar
            key={label}
            dataKey={label}
            stackId="stack"
            fill={CHART_COLORS[i % CHART_COLORS.length]}
            radius={i === defs.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
