"use client"

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Treemap,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  FunnelChart,
  Funnel,
  LabelList,
} from "recharts"
import { ChartShell } from "./ChartShell"
import { formatInr } from "@/lib/chat/visualization/format-inr"
import type { ChartPlan, NormalizedRow } from "@/lib/chat/visualization"
import { useChartTheme } from "@/hooks/useChartTheme"

const PIE_COLORS = ["#4A90D9", "#B8860B", "#2A9D8F", "#E57373", "#7B68EE", "#E07B54"]

export function PieChartView({ rows, plan, donut = false }: { rows: NormalizedRow[]; plan: ChartPlan; donut?: boolean }) {
  const metric = plan.series[0]?.key
  const data = rows.map((r) => ({
    name: String(r[plan.xKey] ?? ""),
    value: Number(r[metric ?? ""] ?? 0),
  }))

  const ct = useChartTheme()

  return (
    <ChartShell title={plan.title}>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={donut ? 55 : 0}
            outerRadius={90}
            paddingAngle={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number) => formatInr(v)} contentStyle={ct.tooltip} />
        </PieChart>
      </ResponsiveContainer>
    </ChartShell>
  )
}

export function TreemapChartView({ rows, plan }: { rows: NormalizedRow[]; plan: ChartPlan }) {
  const metric = plan.series[0]?.key
  const data = rows.map((r) => ({
    name: String(r[plan.xKey] ?? ""),
    size: Number(r[metric ?? ""] ?? 0),
  }))

  return (
    <ChartShell title={plan.title}>
      <ResponsiveContainer width="100%" height={260}>
        <Treemap data={data} dataKey="size" aspectRatio={4 / 3} stroke="#fff" fill="#4A90D9" />
      </ResponsiveContainer>
    </ChartShell>
  )
}

export function RadarChartView({ rows, plan }: { rows: NormalizedRow[]; plan: ChartPlan }) {
  const ct = useChartTheme()
  const row = rows[0]
  const data = plan.series.map((s) => ({
    metric: s.label,
    value: Number(row[s.key] ?? 0),
  }))

  return (
    <ChartShell title={plan.title}>
      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={data}>
          <PolarGrid stroke={ct.polar} />
          <PolarAngleAxis dataKey="metric" tick={{ fill: ct.tick, fontSize: 11 }} />
          <PolarRadiusAxis tick={{ fill: ct.tick, fontSize: 10 }} />
          <Radar dataKey="value" stroke="#4A90D9" fill="#4A90D9" fillOpacity={0.3} />
          <Tooltip contentStyle={ct.tooltip} />
        </RadarChart>
      </ResponsiveContainer>
    </ChartShell>
  )
}

export function FunnelChartView({ rows, plan }: { rows: NormalizedRow[]; plan: ChartPlan }) {
  const ct = useChartTheme()
  const row = rows[0] ?? rows
  const data = plan.series
    .map((s) => ({
      name: s.label,
      value: Number((Array.isArray(row) ? row[0] : row)[s.key] ?? 0),
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)

  return (
    <ChartShell title={plan.title}>
      <ResponsiveContainer width="100%" height={280}>
        <FunnelChart>
          <Tooltip contentStyle={ct.tooltip} />
          <Funnel dataKey="value" data={data} isAnimationActive>
            <LabelList position="right" fill={ct.tick} stroke="none" dataKey="name" fontSize={11} />
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
    </ChartShell>
  )
}
