"use client"

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts"
import { useChartTheme } from "@/hooks/useChartTheme"
import {
  detectDateKey,
  formatAxisTick,
  formatMeasureValue,
  measureFormat,
  type MeasureFormat,
  prettyLabel,
  timeAxisMinTickGap,
  timeAxisTickInterval,
} from "@/components/charts/format"

interface Props {
  rows: Record<string, unknown>[]
}

function shortDate(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { month: "short", day: "numeric" })
}

const LINE_COLORS = ["#34d399", "#f97316", "#a78bfa", "#60a5fa", "#fb7185", "#fbbf24"]

function detectNumericKeys(rows: Record<string, unknown>[], dateKey: string | null): string[] {
  if (!rows.length) return []
  return Object.keys(rows[0]).filter((k) => {
    if (k === dateKey) return false
    if (/\.id$|_id$|surrogate/i.test(k)) return false
    const v = rows[0][k]
    return typeof v === "number" || (typeof v === "string" && !isNaN(Number(v)) && String(v).trim() !== "")
  })
}

function axisForFormat(fmt: MeasureFormat): "left" | "right" {
  return fmt === "currency" || fmt === "ratio" ? "left" : "right"
}

export function TrendChart({ rows }: Props) {
  const ct = useChartTheme()

  if (!rows?.length) {
    return <p className="text-sm text-stone-500 dark:text-night-500">No trend data.</p>
  }

  const dateKey = detectDateKey(rows)
  const numericKeys = detectNumericKeys(rows, dateKey)
  if (!dateKey || !numericKeys.length) {
    return (
      <p className="text-sm text-stone-500 dark:text-night-500">
        Cannot render chart — unexpected data shape.
      </p>
    )
  }

  const priority = (k: string) => {
    if (/revenue|gross_revenue|sales/i.test(k)) return 0
    if (/ad_spend|spend|cost/i.test(k)) return 1
    if (/net_profit|profit/i.test(k)) return 2
    if (/orders|gross_profit|cogs/i.test(k)) return 3
    return 4
  }
  const sortedKeys = [...numericKeys].sort((a, b) => priority(a) - priority(b)).slice(0, 5)

  const sorted = [...rows].sort((a, b) => {
    const av = String(a[dateKey] ?? "")
    const bv = String(b[dateKey] ?? "")
    return av < bv ? -1 : av > bv ? 1 : 0
  })

  const metricDefs = sortedKeys.map((rawKey) => {
    const format = measureFormat(rawKey)
    return {
      rawKey,
      label: prettyLabel(rawKey),
      format,
      axis: axisForFormat(format),
    }
  })

  const hasLeft = metricDefs.some((m) => m.axis === "left")
  const hasRight = metricDefs.some((m) => m.axis === "right")
  const leftFormats = metricDefs.filter((m) => m.axis === "left").map((m) => m.format)
  const rightFormats = metricDefs.filter((m) => m.axis === "right").map((m) => m.format)

  const data = sorted.map((r) => {
    const point: Record<string, unknown> = { date: shortDate(String(r[dateKey] ?? "")) }
    for (const m of metricDefs) {
      point[m.label] = Number(r[m.rawKey] ?? 0)
    }
    return point
  })

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart
        data={data}
        margin={{ top: 4, right: hasRight ? 52 : 12, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
        <XAxis
          dataKey="date"
          tick={{ fill: ct.tick, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          interval={timeAxisTickInterval(data.length)}
          minTickGap={timeAxisMinTickGap(data.length)}
        />
        {hasLeft && (
          <YAxis
            yAxisId="left"
            tickFormatter={(v) => formatAxisTick(v, leftFormats)}
            tick={{ fill: ct.tick, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={62}
          />
        )}
        {hasRight && (
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={(v) => formatAxisTick(v, rightFormats)}
            tick={{ fill: ct.tick, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={52}
          />
        )}
        <Tooltip
          contentStyle={ct.tooltip}
          formatter={(v: number, _name: string, item: { dataKey?: string | number }) => {
            const label = String(item.dataKey ?? "")
            const m = metricDefs.find((d) => d.label === label)
            return [formatMeasureValue(v, m?.rawKey ?? label), label]
          }}
        />
        <Legend wrapperStyle={ct.legend} />
        {metricDefs.map((m, i) => (
          <Line
            key={m.label}
            type="monotone"
            dataKey={m.label}
            yAxisId={hasLeft && hasRight ? m.axis : hasRight ? "right" : "left"}
            stroke={LINE_COLORS[i % LINE_COLORS.length]}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
