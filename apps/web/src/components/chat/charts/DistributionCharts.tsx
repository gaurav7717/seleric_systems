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

function makeAxisFmt(values: number[], fallback: (v: number) => string) {
  const max = Math.max(...values.map(Math.abs))
  if (max <= 1.1 && max > 0) return (v: number) => `${(v * 100).toFixed(2)}%`
  return fallback
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
  const labelKey = plan.labelKey
  const data = rows.map((r) => ({
    x: Number(r[sx?.key ?? ""] ?? 0),
    y: Number(r[sy?.key ?? ""] ?? 0),
    z: sz ? Number(r[sz.key] ?? 0) : 10,
    label: labelKey ? String(r[labelKey] ?? "") : undefined,
  }))

  const ct = useChartTheme()
  const xFmt = makeAxisFmt(data.map((d) => d.x), formatAxisInr)
  const yFmt = makeAxisFmt(data.map((d) => d.y), formatAxisInr)

  return (
    <ChartShell title={plan.title}>
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 8, right: 24, left: 8, bottom: 44 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
          <XAxis
            type="number"
            dataKey="x"
            name={sx?.label}
            tickFormatter={xFmt}
            tick={{ fill: ct.tick, fontSize: 11 }}
            label={{ value: sx?.label ?? "", position: "insideBottom", offset: -28, fill: ct.tick, fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name={sy?.label}
            tickFormatter={yFmt}
            tick={{ fill: ct.tick, fontSize: 11 }}
            label={{ value: sy?.label ?? "", angle: -90, position: "insideLeft", offset: 14, fill: ct.tick, fontSize: 11 }}
          />
          {bubble && <ZAxis type="number" dataKey="z" range={[40, 400]} />}
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={({ payload }) => {
              if (!payload?.length) return null
              const d = payload[0].payload as { x: number; y: number; label?: string }
              return (
                <div style={ct.tooltip} className="text-xs p-2 rounded shadow space-y-0.5">
                  {d.label && <div className="font-semibold truncate max-w-[200px]">{d.label}</div>}
                  <div>{sx?.label}: {xFmt(d.x)}</div>
                  <div>{sy?.label}: {yFmt(d.y)}</div>
                </div>
              )
            }}
          />
          <Scatter data={data} fill={getSeriesColor("generic", 0)} />
        </ScatterChart>
      </ResponsiveContainer>
    </ChartShell>
  )
}
