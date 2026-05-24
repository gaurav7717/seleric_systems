"use client"

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts"
import { ChartShell } from "./ChartShell"
import { LightTooltip } from "./ChartTooltip"
import { histogramBins } from "@/lib/chat/visualization/binning"
import { formatAxisInr } from "@/lib/chat/visualization/format-inr"
import { getSeriesColor } from "@/lib/chat/visualization/column-semantics"
import type { ChartPlan, NormalizedRow } from "@/lib/chat/visualization"
import { useChartTheme } from "@/hooks/useChartTheme"

export function HistogramChartView({ rows, plan }: { rows: NormalizedRow[]; plan: ChartPlan }) {
  const key = plan.series[0]?.key ?? plan.xKey
  const values = rows.map((r) => Number(r[key])).filter((n) => isFinite(n))
  const ct = useChartTheme()
  const bins = histogramBins(values).map((b) => ({ x: b.label, count: b.count }))

  return (
    <ChartShell title={plan.title}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={bins} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
          <XAxis dataKey="x" tick={{ fill: ct.tick, fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={50} />
          <YAxis tick={{ fill: ct.tick, fontSize: 11 }} />
          <Tooltip contentStyle={ct.tooltip} />
          <Bar dataKey="count" fill="#4A90D9" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  )
}

export function ScatterChartView({
  rows,
  plan,
  bubble = false,
}: {
  rows: NormalizedRow[]
  plan: ChartPlan
  bubble?: boolean
}) {
  const [sx, sy, sz] = plan.series
  const data = rows.map((r) => ({
    x: Number(r[sx?.key ?? ""] ?? 0),
    y: Number(r[sy?.key ?? ""] ?? 0),
    z: sz ? Number(r[sz.key] ?? 0) : 10,
  }))

  const ct = useChartTheme()

  return (
    <ChartShell title={plan.title}>
      <ResponsiveContainer width="100%" height={240}>
        <ScatterChart margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
          <XAxis type="number" dataKey="x" name={sx?.label} tickFormatter={formatAxisInr} tick={{ fill: ct.tick, fontSize: 11 }} />
          <YAxis type="number" dataKey="y" name={sy?.label} tickFormatter={formatAxisInr} tick={{ fill: ct.tick, fontSize: 11 }} />
          {bubble && <ZAxis type="number" dataKey="z" range={[40, 400]} />}
          <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<LightTooltip />} />
          <Scatter data={data} fill={getSeriesColor("generic", 0)} />
        </ScatterChart>
      </ResponsiveContainer>
    </ChartShell>
  )
}
