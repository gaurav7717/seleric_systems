"use client"

import { PNL_KPI_LABELS, PNL_KPI_MEASURES } from "@/lib/dashboard/pnl-kpi-constants"

interface Props {
  rows: Record<string, unknown>[]
}

function fmtNum(v: unknown, key: string): string {
  if (v == null || v === "") return "—"
  const n = Number(v)
  if (!isFinite(n)) return String(v)
  if (/order|count/i.test(key)) return n.toLocaleString("en-IN", { maximumFractionDigits: 0 })
  if (/pct|margin/i.test(key)) return `${n.toFixed(1)}%`
  const abs = Math.abs(n)
  if (abs >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)}L`
  if (abs >= 1_000) return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
  return `₹${n.toFixed(2)}`
}

function pct(curr: unknown, prev: unknown): number | undefined {
  const c = Number(curr)
  const p = Number(prev)
  if (!isFinite(c) || !isFinite(p) || p === 0) return undefined
  return ((c - p) / Math.abs(p)) * 100
}

function dateLabel(row: Record<string, unknown>): string {
  const raw = row["daily_pnl.report_date"]
  if (!raw) return "—"
  return String(raw).slice(0, 10)
}

/** #01 P&L KPI strip — today vs yesterday, canonical daily_pnl measures. */
export function PnlKpiStrip({ rows }: Props) {
  if (!rows?.length) {
    return <p className="text-sm text-stone-500 dark:text-night-500">No P&L data for today or yesterday.</p>
  }

  const sorted = [...rows].sort((a, b) => dateLabel(a).localeCompare(dateLabel(b)))
  const prev = sorted.length >= 2 ? sorted[sorted.length - 2] : null
  const curr = sorted[sorted.length - 1]
  const prevDate = prev ? dateLabel(prev) : null

  return (
    <div className="flex flex-wrap gap-3">
      {PNL_KPI_MEASURES.map((key) => {
        const trend = prev ? pct(curr[key], prev[key]) : undefined
        const invert = /spend|cogs/i.test(key)
        const trendPositive = invert ? (trend ?? 0) < 0 : (trend ?? 0) > 0
        return (
          <div
            key={key}
            className="rounded-lg border border-stone-200 dark:border-night-800 bg-stone-50 dark:bg-night-850 px-4 py-3 flex flex-col gap-1 min-w-[130px]"
          >
            <span className="text-xs text-stone-500 dark:text-night-500 uppercase tracking-wide">
              {PNL_KPI_LABELS[key]}
            </span>
            <span className="text-lg font-semibold text-stone-900 dark:text-night-50">{fmtNum(curr[key], key)}</span>
            {prev && prevDate && (
              <span className="text-xs text-stone-500 dark:text-night-500">
                {prevDate}: {fmtNum(prev[key], key)}
              </span>
            )}
            {trend !== undefined && (
              <span
                className={`text-xs font-medium ${
                  trendPositive
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {trend > 0 ? "+" : ""}
                {trend.toFixed(1)}% vs prev
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
