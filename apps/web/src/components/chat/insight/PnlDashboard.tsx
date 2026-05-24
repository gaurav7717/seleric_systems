"use client"

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from "recharts"
import type { ChartPlan, NormalizedRow } from "@/lib/chat/visualization"
import { analyzeColumns } from "@/lib/chat/visualization/column-semantics"
import { normalizeRows } from "@/lib/chat/visualization/normalize-rows"
import { formatAxisInr, formatInr } from "@/lib/chat/visualization/format-inr"
import { DERIVED_FORMULA_FOOTER } from "@/lib/chat/visualization/derive-metrics"
import { ChartShell } from "../charts/ChartShell"
import { LightTooltip } from "../charts/ChartTooltip"
import { InsightDataTable } from "./InsightDataTable"

const GRID = "#E8E5DC"
const TICK = "#6B7280"

function buildChartRows(
  rows: NormalizedRow[],
  dateKey: string,
  profile: ReturnType<typeof analyzeColumns>
) {
  const labelKey = `${dateKey}__label`

  // Resolve field keys by semantic role so any cube's data renders correctly.
  const colsByRole = (role: string) => profile.columns.filter((c) => c.metricRole === role)
  const revenueKey =
    colsByRole("revenue").find((c) => /sales_ex|ex_gst/i.test(c.key))?.key ??
    colsByRole("revenue")[0]?.key
  const spendKey = colsByRole("spend")[0]?.key
  const grossProfitKey = colsByRole("profit").find((c) => /gross/i.test(c.key))?.key
  const netProfitKey =
    colsByRole("profit").find((c) => /net/i.test(c.key))?.key ?? colsByRole("profit")[0]?.key

  return rows.map((r) => {
    const x = (r[labelKey] as string) ?? String(r[dateKey] ?? "").slice(0, 7)
    return {
      x,
      revenue: revenueKey ? Number(r[revenueKey] ?? 0) : 0,
      spend: spendKey ? Number(r[spendKey] ?? 0) : 0,
      grossProfit: grossProfitKey ? Number(r[grossProfitKey] ?? 0) : 0,
      netProfit: netProfitKey ? Number(r[netProfitKey] ?? 0) : 0,
      cac: Number(r["derived.cac"] ?? 0),
      ltv: Number(r["derived.ltv_estimate"] ?? 0),
    }
  })
}

export function PnlDashboard({
  rows,
  plan,
}: {
  rows: NormalizedRow[]
  plan: ChartPlan
}) {
  const { rows: normalized, profile } = normalizeRows(rows as Record<string, unknown>[])
  const dateKey = profile.dateKey ?? plan.xKey
  const data = buildChartRows(normalized, dateKey, profile)

  return (
    <div className="space-y-1">
      <ChartShell title={plan.title ?? "Monthly P&L with CAC & LTV metrics"}>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey="x" tick={{ fill: TICK, fontSize: 11 }} />
            <YAxis tickFormatter={formatAxisInr} tick={{ fill: TICK, fontSize: 11 }} width={56} />
            <Tooltip content={<LightTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="revenue" name="Revenue ex-GST" fill="#4A90D9" radius={[2, 2, 0, 0]} />
            <Bar dataKey="spend" name="Ad spend" fill="#B8860B" radius={[2, 2, 0, 0]} />
            <Bar dataKey="grossProfit" name="Gross profit" fill="#2A9D8F" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartShell>

      <ChartShell title="Net profit (loss = red bar below zero)">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey="x" tick={{ fill: TICK, fontSize: 11 }} />
            <YAxis tickFormatter={formatAxisInr} tick={{ fill: TICK, fontSize: 11 }} width={56} />
            <Tooltip formatter={(v: number) => formatInr(v, { signed: true })} />
            <Bar dataKey="netProfit" radius={[2, 2, 0, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.netProfit >= 0 ? "#2A9D8F" : "#E57373"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartShell>

      {data.some((d) => d.cac > 0 || d.ltv > 0) && (
        <ChartShell title="CAC (₹) | LTV (₹)">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              <XAxis dataKey="x" tick={{ fill: TICK, fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `₹${v}`} tick={{ fill: TICK, fontSize: 11 }} width={48} />
              <Tooltip content={<LightTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="cac" name="CAC" stroke="#4A90D9" strokeWidth={2} dot={{ r: 3 }} />
              <Line
                type="monotone"
                dataKey="ltv"
                name="Est. LTV"
                stroke="#B8860B"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartShell>
      )}

      <div className="rounded-xl bg-insight-canvas border border-insight-border px-4 py-3">
        <InsightDataTable rows={normalized} title="Full monthly table" />
        <p className="text-xs text-stone-500 font-sans mt-2 border-t border-insight-border pt-2">
          {DERIVED_FORMULA_FOOTER}
        </p>
      </div>
    </div>
  )
}
