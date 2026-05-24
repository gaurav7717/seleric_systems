"use client"

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts"

interface Props {
  rows: Record<string, unknown>[]
}

function fmtK(v: number): string {
  if (Math.abs(v) >= 1_00_000) return `₹${(v / 1_00_000).toFixed(1)}L`
  if (Math.abs(v) >= 1_000) return `₹${(v / 1_000).toFixed(1)}K`
  return `₹${v.toFixed(0)}`
}

function fmtCount(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}K`
  return `${v.toFixed(0)}`
}

function shortDate(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { month: "short", day: "numeric" })
}

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string
}) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-slate-400 mb-2 font-medium">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="mb-1">
          {p.name}: {isCountMetric(p.name) ? fmtCount(p.value) : fmtK(p.value)}
        </p>
      ))}
    </div>
  )
}

const LINE_COLORS = ["#34d399", "#f97316", "#a78bfa", "#60a5fa", "#fb7185", "#fbbf24"]

function detectFields(rows: Record<string, unknown>[]) {
  if (!rows.length) return { dateKey: null, numericKeys: [] }
  const keys = Object.keys(rows[0])

  const dateKey =
    keys.find((k) => /report_date|created_at|date_start|date_stop|period|\.day$|\.week$|\.month$/i.test(k) && !k.endsWith(".day") === false) ??
    keys.find((k) => /report_date|created_at|date_start|date\b/i.test(k) && typeof rows[0][k] === "string" && String(rows[0][k]).includes("T")) ??
    keys.find((k) => /date/i.test(k))

  const numericKeys = keys.filter((k) => {
    if (k === dateKey) return false
    if (/\.id$|_id$|surrogate/i.test(k)) return false
    const v = rows[0][k]
    return typeof v === "number" || (typeof v === "string" && !isNaN(Number(v)) && v.trim() !== "")
  })

  // Prefer revenue/spend/profit keys for display
  const priority = (k: string) => {
    if (/revenue|gross_revenue|sales/i.test(k)) return 0
    if (/ad_spend|spend|cost/i.test(k)) return 1
    if (/net_profit|profit/i.test(k)) return 2
    if (/orders|gross_profit|cogs/i.test(k)) return 3
    return 4
  }
  numericKeys.sort((a, b) => priority(a) - priority(b))

  return { dateKey, numericKeys: numericKeys.slice(0, 5) }
}

function prettyLabel(key: string): string {
  return key
    .replace(/^[^.]+\./, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function isCountMetric(key: string): boolean {
  return /orders?|count|qty|quantity|units?|clicks?|impressions?|sessions?|visits?/i.test(key)
}

export function TrendChart({ rows }: Props) {
  if (!rows?.length) return <p className="text-sm text-slate-500">No trend data.</p>

  const { dateKey, numericKeys } = detectFields(rows)
  if (!dateKey || !numericKeys.length) return <p className="text-sm text-slate-500">Cannot render chart — unexpected data shape.</p>

  const sorted = [...rows].sort((a, b) => {
    const av = String(a[dateKey] ?? "")
    const bv = String(b[dateKey] ?? "")
    return av < bv ? -1 : av > bv ? 1 : 0
  })

  const metricDefs = numericKeys.map((rawKey) => ({
    rawKey,
    label: prettyLabel(rawKey),
    axis: isCountMetric(rawKey) ? "right" : "left",
  }))

  const hasRightAxis = metricDefs.some((m) => m.axis === "right")

  const data = sorted.map((r) => {
    const point: Record<string, unknown> = { date: shortDate(String(r[dateKey] ?? "")) }
    for (const m of metricDefs) {
      point[m.label] = Number(r[m.rawKey] ?? 0)
    }
    return point
  })

  return (
    <div className="my-3 rounded-xl border border-slate-700 bg-slate-900 p-4">
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: hasRightAxis ? 26 : 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis
            yAxisId="left"
            tickFormatter={fmtK}
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={62}
          />
          {hasRightAxis && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={fmtCount}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={46}
            />
          )}
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
          {metricDefs.map((m, i) => (
            <Line
              key={m.label}
              type="monotone"
              dataKey={m.label}
              yAxisId={m.axis}
              stroke={LINE_COLORS[i % LINE_COLORS.length]}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
