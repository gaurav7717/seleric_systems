import { analyzeColumns, type CubeRow } from "./column-semantics"
import { deriveRowMetrics } from "./derive-metrics"
import type { PeriodSummary } from "./types"

export function aggregatePeriod(rows: CubeRow[]): PeriodSummary {
  if (!rows.length) return {}

  const enriched = rows.map(deriveRowMetrics)
  const profile = analyzeColumns(enriched)
  const summary: PeriodSummary = {}

  for (const key of profile.metricKeys) {
    const values = enriched.map((r) => Number(r[key])).filter((n) => isFinite(n))
    if (!values.length) continue

    const col = profile.columns.find((c) => c.key === key)
    const isRate = col?.role === "rate" || /margin|pct|rate|roas/i.test(key)

    if (isRate && values.length > 1) {
      summary[key] = values.reduce((a, b) => a + b, 0) / values.length
    } else if (/profit|revenue|spend|cogs|cost|orders/i.test(key)) {
      summary[key] = values.reduce((a, b) => a + b, 0)
    } else {
      summary[key] = values.reduce((a, b) => a + b, 0) / values.length
    }
  }

  // Re-derive period-level CAC/LTV
  const periodRow = deriveRowMetrics(summary as CubeRow)
  for (const [k, v] of Object.entries(periodRow)) {
    if (k.startsWith("derived.")) summary[k] = v as number
  }

  return summary
}

export function bestMonthLabel(rows: CubeRow[], dateKey: string | null, profitKey: string | null): string | null {
  if (!dateKey || !profitKey || !rows.length) return null
  let best: { date: string; profit: number } | null = null
  for (const row of rows) {
    const p = Number(row[profitKey] ?? 0)
    const d = String(row[dateKey] ?? "")
    if (!best || p > best.profit) best = { date: d, profit: p }
  }
  if (!best) return null
  const d = new Date(best.date)
  const label = isNaN(d.getTime()) ? best.date.slice(0, 7) : d.toLocaleDateString("en-IN", { month: "short", year: "numeric" })
  return `${label}`
}
