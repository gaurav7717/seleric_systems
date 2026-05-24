"use client"

import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ComposedChart,
  Cell,
} from "recharts"
import { ChartShell } from "./ChartShell"
import { LightTooltip } from "./ChartTooltip"
import { formatAxisInr, formatInr } from "@/lib/chat/visualization/format-inr"
import { getSeriesColor } from "@/lib/chat/visualization/column-semantics"
import type { ChartPlan, NormalizedRow } from "@/lib/chat/visualization"
import { useChartTheme } from "@/hooks/useChartTheme"

function buildData(rows: NormalizedRow[], plan: ChartPlan) {
  const xKey = plan.xKey
  const labelKey = `${xKey}__label`
  return rows.map((row) => {
    const x =
      (row[labelKey] as string) ??
      (typeof row[xKey] === "string"
        ? String(row[xKey]).slice(0, 10)
        : String(row[xKey] ?? ""))
    const point: Record<string, string | number> = { x }
    if (plan.options?.horizontal && plan.xKey !== "x") {
      point.category = String(row[plan.xKey] ?? x)
    }
    for (const s of plan.series) {
      point[s.label] = Number(row[s.key] ?? 0)
    }
    return point
  })
}

export function LineChartView({
  rows,
  plan,
  area = false,
  stacked = false,
  step = false,
  cumulative = false,
}: {
  rows: NormalizedRow[]
  plan: ChartPlan
  area?: boolean
  stacked?: boolean
  step?: boolean
  cumulative?: boolean
}) {
  let data = buildData(rows, plan)
  if (cumulative) {
    const labels = plan.series.map((s) => s.label)
    let running: Record<string, number> = {}
    data = data.map((point) => {
      const next = { ...point }
      for (const l of labels) {
        running[l] = (running[l] ?? 0) + Number(point[l] ?? 0)
        next[l] = running[l]
      }
      return next
    })
  }

  const ct = useChartTheme()
  const height = plan.options?.height ?? 240
  const Chart = area ? AreaChart : LineChart
  const hasRight = plan.series.some((s) => s.axis === "right")

  return (
    <ChartShell title={plan.title}>
      <ResponsiveContainer width="100%" height={height}>
        <Chart data={data} margin={{ top: 8, right: hasRight ? 40 : 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
          <XAxis dataKey="x" tick={{ fill: ct.tick, fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis
            yAxisId="left"
            tickFormatter={formatAxisInr}
            tick={{ fill: ct.tick, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          {hasRight && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: ct.tick, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={40}
            />
          )}
          <Tooltip content={<LightTooltip />} />
          <Legend wrapperStyle={ct.legend} />
          {plan.series.map((s, i) =>
            area ? (
              <Area
                key={s.label}
                yAxisId={s.axis === "right" ? "right" : "left"}
                type={step ? "step" : "monotone"}
                dataKey={s.label}
                stackId={stacked ? "a" : undefined}
                stroke={getSeriesColor(s.role, i)}
                fill={getSeriesColor(s.role, i)}
                fillOpacity={stacked ? 0.6 : 0.15}
                strokeWidth={2}
              />
            ) : (
              <Line
                key={s.label}
                yAxisId={s.axis === "right" ? "right" : "left"}
                type={step ? "step" : "monotone"}
                dataKey={s.label}
                stroke={getSeriesColor(s.role, i)}
                strokeWidth={2}
                strokeDasharray={s.strokeDasharray}
                dot={{ r: 3 }}
              />
            )
          )}
        </Chart>
      </ResponsiveContainer>
    </ChartShell>
  )
}

export function DualLineChartView({ rows, plan }: { rows: NormalizedRow[]; plan: ChartPlan }) {
  return <LineChartView rows={rows} plan={plan} />
}

export function BarChartView({
  rows,
  plan,
  horizontal = false,
  stacked = false,
  grouped = true,
}: {
  rows: NormalizedRow[]
  plan: ChartPlan
  horizontal?: boolean
  stacked?: boolean
  grouped?: boolean
}) {
  const ct = useChartTheme()
  const data = buildData(rows, plan)
  const height = plan.options?.height ?? 240

  return (
    <ChartShell title={plan.title}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={{ top: 8, right: 16, left: horizontal ? 80 : 8, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
          {horizontal ? (
            <>
              <XAxis type="number" tickFormatter={formatAxisInr} tick={{ fill: ct.tick, fontSize: 11 }} />
              <YAxis type="category" dataKey="x" tick={{ fill: ct.tick, fontSize: 11 }} width={72} />
            </>
          ) : (
            <>
              <XAxis dataKey="x" tick={{ fill: ct.tick, fontSize: 11 }} />
              <YAxis tickFormatter={formatAxisInr} tick={{ fill: ct.tick, fontSize: 11 }} width={56} />
            </>
          )}
          <Tooltip content={<LightTooltip />} />
          <Legend wrapperStyle={ct.legend} />
          {plan.series.map((s, i) => (
            <Bar
              key={s.label}
              dataKey={s.label}
              fill={getSeriesColor(s.role, i)}
              stackId={stacked ? "s" : undefined}
              radius={[2, 2, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  )
}

export function DivergingBarChartView({ rows, plan }: { rows: NormalizedRow[]; plan: ChartPlan }) {
  const ct = useChartTheme()
  const data = buildData(rows, plan).map((d) => ({
    ...d,
    value: Number(d[plan.series[0]?.label ?? "value"] ?? 0),
  }))
  const height = plan.options?.height ?? 200

  return (
    <ChartShell title={plan.title}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
          <XAxis dataKey="x" tick={{ fill: ct.tick, fontSize: 11 }} />
          <YAxis tickFormatter={formatAxisInr} tick={{ fill: ct.tick, fontSize: 11 }} width={56} />
          <Tooltip
            formatter={(v: number) => formatInr(v, { signed: true })}
            contentStyle={ct.tooltip}
          />
          <Bar dataKey="value" radius={[2, 2, 0, 0]}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.value >= 0 ? "#2A9D8F" : "#E57373"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  )
}

export function ComposedChartView({ rows, plan }: { rows: NormalizedRow[]; plan: ChartPlan }) {
  const ct = useChartTheme()
  const data = buildData(rows, plan)
  const [barSeries, ...lineSeries] = plan.series

  return (
    <ChartShell title={plan.title}>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
          <XAxis dataKey="x" tick={{ fill: ct.tick, fontSize: 11 }} />
          <YAxis tickFormatter={formatAxisInr} tick={{ fill: ct.tick, fontSize: 11 }} width={56} />
          <Tooltip content={<LightTooltip />} />
          <Legend wrapperStyle={ct.legend} />
          {barSeries && (
            <Bar dataKey={barSeries.label} fill={getSeriesColor(barSeries.role, 0)} radius={[2, 2, 0, 0]} />
          )}
          {lineSeries.map((s, i) => (
            <Line
              key={s.label}
              type="monotone"
              dataKey={s.label}
              stroke={getSeriesColor(s.role, i + 1)}
              strokeWidth={2}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartShell>
  )
}
