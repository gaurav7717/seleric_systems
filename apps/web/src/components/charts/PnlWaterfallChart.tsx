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
import { useChartTheme } from "@/hooks/useChartTheme"

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
  const ct = useChartTheme()

  if (!steps.some((s) => s.value !== 0)) {
    return <p className="text-sm text-stone-500 dark:text-night-500">No P&L data for this period.</p>
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
        <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
        <XAxis
          dataKey="name"
          tick={{ fill: ct.tick, fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          interval={0}
          angle={-15}
          textAnchor="end"
          height={52}
        />
        <YAxis
          tickFormatter={fmtCurrency}
          tick={{ fill: ct.tick, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={62}
        />
        <Tooltip
          formatter={(v: number, _n: string, p: { payload?: { signed?: number } }) =>
            fmtCurrency(p.payload?.signed ?? v)
          }
          contentStyle={ct.tooltip}
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
