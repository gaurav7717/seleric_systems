"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { fmtCurrency } from "./format"

interface Step {
  name: string
  value: number
  kind: "start" | "delta" | "subtotal" | "total"
}

interface Props {
  steps: Step[]
}

/** Stepped P&L waterfall: sales → −COGS → gross profit → −ad spend → net profit. */
export function PnlWaterfallChart({ steps }: Props) {
  if (!steps.some((s) => s.value !== 0)) {
    return <p className="text-sm text-slate-500">No P&L data for this period.</p>
  }

  const floating = steps.map((step) => ({
    name: step.name,
    value: Math.abs(step.value),
    signed: step.value,
    fill:
      step.kind === "delta"
        ? "#fb7185"
        : step.kind === "total"
          ? "#34d399"
          : step.kind === "subtotal"
            ? "#a78bfa"
            : "#60a5fa",
  }))

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={floating} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis
          dataKey="name"
          tick={{ fill: "#94a3b8", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          interval={0}
          angle={-15}
          textAnchor="end"
          height={52}
        />
        <YAxis
          tickFormatter={fmtCurrency}
          tick={{ fill: "#94a3b8", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={62}
        />
        <Tooltip
          formatter={(v: number, _n: string, p: { payload?: { signed?: number } }) =>
            fmtCurrency(p.payload?.signed ?? v)
          }
          contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {floating.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
