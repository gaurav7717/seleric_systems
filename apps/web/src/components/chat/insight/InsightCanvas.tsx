"use client"

import { detectChartPlan, detectInsightLayout, normalizeRows } from "@/lib/chat/visualization"
import { DERIVED_FORMULA_FOOTER } from "@/lib/chat/visualization/derive-metrics"
import type { CubeRow } from "@/lib/chat/visualization/column-semantics"
import type { ChartPlan } from "@/lib/chat/visualization/types"
import type { MergedToolData } from "@/lib/chat/merge-tool-results"
import { KpiSummaryGrid } from "./KpiSummaryGrid"
import { MultiChartLayout } from "./MultiChartLayout"
import { CompiledInsights } from "./CompiledInsights"
import { ChartRenderer } from "../charts/ChartRenderer"

function buildChannelPlan(rows: CubeRow[]): ChartPlan | null {
  if (!rows.length) return null
  const sample = rows[0]
  const xKey =
    "channel" in sample
      ? "channel"
      : Object.keys(sample).find((k) => /channel|platform|source/i.test(k)) ?? "channel"
  const metricCandidates = [
    { key: "revenue", label: "Revenue" },
    { key: "adSpend", label: "Ad spend" },
    { key: "netProfit", label: "Net profit" },
  ]
  const series = metricCandidates.filter((s) => s.key in sample)
  if (!series.length) {
    const numeric = Object.keys(sample).filter((k) => {
      if (k === xKey) return false
      return typeof sample[k] === "number"
    })
    if (!numeric.length) return null
    return {
      kind: "grouped_bar",
      title: "Channel split",
      xKey,
      series: numeric.slice(0, 3).map((k) => ({ key: k, label: k })),
    }
  }
  return {
    kind: "grouped_bar",
    title: "Channel split (Meta · Google · Organic)",
    xKey,
    series,
  }
}

export function InsightCanvas({ merged }: { merged: MergedToolData }) {
  const chartRows = (merged.pnlSeriesRows.length ? merged.pnlSeriesRows : merged.seriesRows) as CubeRow[]
  if (!chartRows.length && !merged.channelRows.length) return null

  const plans = chartRows.length ? detectChartPlan(chartRows, merged.hintType) : []
  const layout = detectInsightLayout(plans)
  const { rows: normalized } = normalizeRows(chartRows)

  const showKpi =
    chartRows.length > 0 &&
    (layout === "pnl_dashboard" ||
      layout === "summary_kpi" ||
      plans.some((p) => p.kind === "summary_kpi"))

  const chartPlans = plans.filter(
    (p) => p.kind !== "summary_kpi" && !(layout === "pnl_dashboard" && p.kind === "table")
  )

  const channelPlan = buildChannelPlan(merged.channelRows)

  return (
    <div className="w-full my-2 rounded-xl bg-insight-canvas/50 dark:bg-night-900 border border-insight-border dark:border-night-800 p-3 sm:p-4">
      {showKpi && (
        <KpiSummaryGrid
          seriesRows={chartRows}
          summaryRows={merged.summaryRows}
        />
      )}

      {layout === "pnl_dashboard" && chartPlans[0]?.kind === "pnl_dashboard" ? (
        <ChartRenderer plan={chartPlans[0]} rows={normalized} />
      ) : layout === "single_chart" && chartPlans.length === 1 ? (
        <ChartRenderer plan={chartPlans[0]} rows={normalized} />
      ) : chartPlans.length > 0 ? (
        <MultiChartLayout plans={chartPlans} rows={normalized} />
      ) : chartRows.length > 0 ? (
        <MultiChartLayout
          plans={[{ kind: "table", title: "Data", xKey: "x", series: [] }]}
          rows={normalized}
        />
      ) : null}

      {channelPlan && merged.channelRows.length > 0 && (
        <ChartRenderer
          plan={channelPlan}
          rows={merged.channelRows as Record<string, string | number | null>[]}
        />
      )}

      <CompiledInsights merged={merged} />

      {showKpi && layout !== "pnl_dashboard" && (
        <p className="text-xs text-stone-500 dark:text-night-500 font-sans px-1 mt-1">{DERIVED_FORMULA_FOOTER}</p>
      )}
    </div>
  )
}
