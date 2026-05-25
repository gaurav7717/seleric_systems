import {
  analyzeColumns,
  hasFunnelColumns,
  isPnlShape,
  type CubeRow,
} from "./column-semantics"
import { prettyLabel } from "./format-inr"
import type { ChartPlan, ChartSeries, InsightLayout } from "./types"

function seriesFromKeys(keys: string[], profile: ReturnType<typeof analyzeColumns>): ChartSeries[] {
  return keys.slice(0, 5).map((key) => {
    const col = profile.columns.find((c) => c.key === key)
    return {
      key,
      label: prettyLabel(key),
      role: col?.metricRole,
      axis: col?.role === "count" ? "right" : "left",
    }
  })
}

function pickPnlMetrics(profile: ReturnType<typeof analyzeColumns>): string[] {
  const priority = (k: string) => {
    const col = profile.columns.find((c) => c.key === k)
    const r = col?.metricRole
    if (/sales_ex|total_sales_ex/i.test(k)) return 0
    if (r === "revenue") return 1
    if (r === "spend") return 2
    if (r === "profit" && /gross/i.test(k)) return 3
    if (r === "profit" && /net/i.test(k)) return 4
    if (r === "profit") return 5
    return 6
  }
  const candidates = [...profile.metricKeys]
    .filter((k) => {
      const col = profile.columns.find((c) => c.key === k)
      return col?.metricRole && col.metricRole !== "orders"
    })
    .sort((a, b) => priority(a) - priority(b))

  const out: string[] = []
  let hasRevenue = false
  for (const k of candidates) {
    const col = profile.columns.find((c) => c.key === k)
    if (col?.metricRole === "revenue") {
      if (hasRevenue) continue
      hasRevenue = true
    }
    out.push(k)
    if (out.length >= 4) break
  }
  return out
}

export function detectInsightLayout(plans: ChartPlan[]): InsightLayout {
  if (plans.some((p) => p.kind === "pnl_dashboard")) return "pnl_dashboard"
  if (plans.some((p) => p.kind === "summary_kpi") && plans.length === 1) return "summary_kpi"
  if (plans.length > 1) return "multi_chart"
  if (plans.length === 1 && plans[0].kind === "table") return "table_only"
  return plans.length ? "single_chart" : "table_only"
}

export function detectChartPlan(rows: CubeRow[], hintType?: string): ChartPlan[] {
  if (!rows.length) return [{ kind: "table", xKey: "x", series: [] }]

  const profile = analyzeColumns(rows)
  const plans: ChartPlan[] = []
  const xDate = profile.dateKey ?? profile.categoryKey ?? profile.metricKeys[0] ?? "x"

  // 0. Ranked list hint — pair_count / top_n outputs always render as horizontal bar
  if (hintType === "ranked" && profile.categoryKey) {
    const metrics = profile.metricKeys.filter((k) => k !== profile.categoryKey)
    if (metrics.length >= 1) {
      plans.push({
        kind: "horizontal_bar",
        title: prettyLabel(metrics[0]),
        xKey: profile.categoryKey,
        series: seriesFromKeys(metrics.slice(0, 2), profile),
        options: { horizontal: true },
      })
      plans.push({ kind: "table", title: "Full data", xKey: profile.categoryKey, series: [] })
      return plans
    }
  }

  // 1. P&L dashboard
  if (isPnlShape(profile) && profile.rowCount >= 4) {
    plans.push({
      kind: "pnl_dashboard",
      title: "Monthly P&L with CAC & LTV metrics",
      xKey: profile.dateKey!,
      series: seriesFromKeys(pickPnlMetrics(profile), profile),
    })
    plans.push({ kind: "summary_kpi", xKey: xDate, series: [] })
    return plans.slice(0, 4)
  }

  const keys = Object.keys(rows[0])

  // 2. Funnel — only when there is no category (e.g. adset_name) dimension.
  // If a category key exists the data is a per-entity comparison, not a conversion funnel.
  if (hasFunnelColumns(keys) && !profile.categoryKey) {
    const funnelKeys = keys.filter((k) =>
      /impression|click|view|cart|checkout|purchase|order/i.test(k)
    )
    plans.push({
      kind: "funnel",
      title: "Funnel",
      xKey: "stage",
      series: seriesFromKeys(funnelKeys.slice(0, 6), profile),
    })
    return plans
  }

  // 3. Channel breakdown — detect by category key name or hint
  const channelKey = profile.categoryKey && /channel|platform|source/i.test(profile.categoryKey)
    ? profile.categoryKey
    : hintType === "channel" && profile.categoryKey
      ? profile.categoryKey
      : null
  if (channelKey) {
    const metricKeys = profile.metricKeys.filter(
      (k) => profile.columns.find((c) => c.key === k)?.metricRole !== "orders"
    )
    plans.push({
      kind: "grouped_bar",
      title: "Channel breakdown",
      xKey: channelKey,
      series: seriesFromKeys(metricKeys.slice(0, 4), profile),
    })
    return plans
  }

  // 4. Small aggregate KPI — few rows, multiple metrics (must come before scatter)
  if (profile.rowCount <= 3 && profile.metricKeys.length >= 2) {
    plans.push({ kind: "summary_kpi", xKey: "summary", series: [] })
    return plans
  }

  // 5a. Scatter / bubble — two or three numerics, no date, no category, enough rows to be meaningful
  if (!profile.dateKey && profile.metricKeys.length >= 2 && !profile.categoryKey && profile.rowCount >= 4) {
    const s = seriesFromKeys(profile.metricKeys, profile)
    if (profile.metricKeys.length >= 3) {
      plans.push({
        kind: "bubble",
        title: "Correlation",
        xKey: profile.metricKeys[0],
        series: s.slice(0, 3),
      })
    } else {
      plans.push({
        kind: "scatter",
        title: "Correlation",
        xKey: profile.metricKeys[0],
        series: s.slice(0, 2),
      })
    }
    return plans
  }

  // 5b. Category + metrics
  if (profile.categoryKey && !profile.dateKey) {
    const metrics = profile.metricKeys.filter((k) => k !== profile.categoryKey)

    // Rate-vs-rate scatter: e.g. CTR vs conversion rate by creative — shows outliers as labeled dots
    const rateKeys = metrics.filter((k) => profile.columns.find((c) => c.key === k)?.role === "rate")
    if (rateKeys.length >= 2) {
      plans.push({
        kind: "scatter",
        title: `${prettyLabel(rateKeys[0])} vs ${prettyLabel(rateKeys[1])}`,
        xKey: rateKeys[0],
        labelKey: profile.categoryKey,
        series: [
          { key: rateKeys[0], label: prettyLabel(rateKeys[0]) },
          { key: rateKeys[1], label: prettyLabel(rateKeys[1]) },
        ],
      })
      plans.push({ kind: "table", title: "Full data", xKey: profile.categoryKey, series: [] })
      return plans
    }

    const categories = new Set(rows.map((r) => String(r[profile.categoryKey!])))
    if (metrics.length === 1 && categories.size <= 6) {
      plans.push({
        kind: "pie",
        title: prettyLabel(metrics[0]),
        xKey: profile.categoryKey,
        series: [{ key: metrics[0], label: prettyLabel(metrics[0]) }],
      })
    } else if (metrics.length === 1) {
      plans.push({
        kind: "horizontal_bar",
        title: prettyLabel(metrics[0]),
        xKey: profile.categoryKey,
        series: [{ key: metrics[0], label: prettyLabel(metrics[0]) }],
        options: { horizontal: true },
      })
    } else {
      plans.push({
        kind: "grouped_bar",
        title: "Comparison",
        xKey: profile.categoryKey,
        series: seriesFromKeys(metrics, profile),
      })
    }
    return plans
  }

  // 6. Time series
  if (profile.dateKey) {
    const metrics = pickPnlMetrics(profile).length
      ? pickPnlMetrics(profile)
      : profile.metricKeys.slice(0, 4)
    const profitKey = metrics.find((k) => /net_profit/i.test(k))

    if (profitKey && profile.rowCount >= 4) {
      plans.push({
        kind: "diverging_bar",
        title: "Net profit (loss below zero)",
        xKey: profile.dateKey,
        series: [{ key: profitKey, label: "Net profit", role: "profit" }],
        options: { diverging: true },
      })
    }

    const cacKey = profile.metricKeys.find((k) => /\bcac\b|derived\.cac/i.test(k)) ?? null
    const ltvKey = profile.metricKeys.find((k) => /\bltv\b|ltv_estimate/i.test(k)) ?? null
    if (cacKey && ltvKey) {
      plans.push({
        kind: "dual_line",
        title: "CAC (₹) | LTV (₹)",
        xKey: profile.dateKey,
        series: [
          { key: cacKey, label: "CAC", role: "cac", axis: "left" },
          { key: ltvKey, label: "Est. LTV", role: "ltv", axis: "left", strokeDasharray: "4 4" },
        ],
      })
    }

    if (profile.rowCount <= 8 && metrics.length >= 2) {
      plans.push({
        kind: "grouped_bar_trend",
        title: "Trend",
        xKey: profile.dateKey,
        series: seriesFromKeys(metrics.slice(0, 3), profile),
      })
    } else {
      plans.push({
        kind: hintType === "channel" ? "line" : metrics.length > 2 ? "line" : "line",
        title: "Trend",
        xKey: profile.dateKey,
        series: seriesFromKeys(metrics.slice(0, 5), profile),
      })
    }

    if (plans.length < 4) {
      plans.push({ kind: "table", title: "Full table", xKey: profile.dateKey, series: [] })
    }

    return plans.slice(0, 4)
  }

  // 7. Histogram — many rows, few dimensions
  if (profile.rowCount > 20 && profile.metricKeys.length >= 1) {
    plans.push({
      kind: "histogram",
      title: `Distribution — ${prettyLabel(profile.metricKeys[0])}`,
      xKey: profile.metricKeys[0],
      series: [{ key: profile.metricKeys[0], label: prettyLabel(profile.metricKeys[0]) }],
    })
    return plans
  }

  // 8. Radar — single row many metrics
  if (profile.rowCount === 1 && profile.metricKeys.length >= 3 && profile.metricKeys.length <= 8) {
    plans.push({
      kind: "radar",
      title: "Profile",
      xKey: "metric",
      series: seriesFromKeys(profile.metricKeys, profile),
    })
    return plans
  }

  // Fallback table
  return [{ kind: "table", title: "Data", xKey: xDate, series: [] }]
}
