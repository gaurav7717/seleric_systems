"use client"

import { fmtCount, fmtCurrency } from "./format"

interface MetricDef {
  label: string
  key: string
  format?: "currency" | "count" | "ratio"
}

interface Props {
  current: Record<string, unknown>
  prior: Record<string, unknown>
  metrics: MetricDef[]
}

function fmt(v: unknown, format: "currency" | "count" | "ratio"): string {
  const n = Number(v)
  if (!isFinite(n)) return "—"
  if (format === "count") return fmtCount(n)
  if (format === "ratio") return n.toFixed(2)
  return fmtCurrency(n)
}

function pct(curr: unknown, prev: unknown): number | undefined {
  const c = Number(curr)
  const p = Number(prev)
  if (!isFinite(c) || !isFinite(p) || p === 0) return undefined
  return ((c - p) / Math.abs(p)) * 100
}

function KpiTile({
  label,
  value,
  sub,
  trend,
  invert,
}: {
  label: string
  value: string
  sub?: string
  trend?: number
  invert?: boolean
}) {
  const trendPositive = invert ? (trend ?? 0) < 0 : (trend ?? 0) > 0
  const trendColor = trend === undefined ? "" : trendPositive ? "text-emerald-400" : "text-red-400"
  const trendSign = (trend ?? 0) > 0 ? "+" : ""
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 flex flex-col gap-1 min-w-[130px]">
      <span className="text-xs text-slate-500 uppercase tracking-wide">{label}</span>
      <span className="text-lg font-semibold text-slate-100">{value}</span>
      {sub && <span className="text-xs text-slate-400">{sub}</span>}
      {trend !== undefined && (
        <span className={`text-xs font-medium ${trendColor}`}>
          {trendSign}{trend.toFixed(1)}% vs prior
        </span>
      )}
    </div>
  )
}

export function PeriodCompareKpis({ current, prior, metrics }: Props) {
  return (
    <div className="flex flex-wrap gap-3">
      {metrics.map(({ label, key, format = "currency" }) => {
        let currVal: unknown = current[key]
        let prevVal: unknown = prior[key]
        if (key === "cpa") {
          const spend = Number(current["marketing_performance.ad_spend"] ?? 0)
          const purchases = Number(current["marketing_performance.purchases"] ?? 0)
          const prevSpend = Number(prior["marketing_performance.ad_spend"] ?? 0)
          const prevPurchases = Number(prior["marketing_performance.purchases"] ?? 0)
          currVal = purchases > 0 ? spend / purchases : null
          prevVal = prevPurchases > 0 ? prevSpend / prevPurchases : null
        }
        return (
          <KpiTile
            key={key}
            label={label}
            value={fmt(currVal, format)}
            sub={`Prior: ${fmt(prevVal, format)}`}
            trend={pct(currVal, prevVal)}
            invert={/spend|cost|cpc|cpm|cpa/i.test(key)}
          />
        )
      })}
    </div>
  )
}
