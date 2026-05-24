"use client"

import type { ChartKind, ChartPlan, NormalizedRow } from "@/lib/chat/visualization"
import {
  LineChartView,
  DualLineChartView,
  BarChartView,
  DivergingBarChartView,
  ComposedChartView,
} from "./SeriesCharts"
import { HistogramChartView, ScatterChartView } from "./DistributionCharts"
import { PieChartView, TreemapChartView, RadarChartView, FunnelChartView } from "./CompositionCharts"
import { PnlDashboard } from "../insight/PnlDashboard"
import { InsightDataTable } from "../insight/InsightDataTable"
import { HeatmapChartView } from "./HeatmapChart"
import { WaterfallChartView } from "./WaterfallChart"

export function ChartRenderer({
  plan,
  rows,
}: {
  plan: ChartPlan
  rows: NormalizedRow[]
}) {
  const kind = plan.kind as ChartKind

  switch (kind) {
    case "pnl_dashboard":
      return <PnlDashboard rows={rows} plan={plan} />
    case "summary_kpi":
      return null
    case "table":
      return <InsightDataTable rows={rows} title={plan.title} />
    case "line":
    case "bar_trend":
    case "cumulative_line":
      return <LineChartView rows={rows} plan={plan} cumulative={kind === "cumulative_line"} />
    case "area":
    case "stacked_area":
      return <LineChartView rows={rows} plan={plan} area stacked={kind === "stacked_area"} />
    case "percent_area":
      return <LineChartView rows={rows} plan={plan} area stacked />
    case "step_line":
      return <LineChartView rows={rows} plan={plan} step />
    case "dual_line":
      return <DualLineChartView rows={rows} plan={plan} />
    case "grouped_bar_trend":
      return <BarChartView rows={rows} plan={plan} grouped />
    case "bar":
      return <BarChartView rows={rows} plan={plan} />
    case "grouped_bar":
      return <BarChartView rows={rows} plan={plan} grouped />
    case "stacked_bar":
      return <BarChartView rows={rows} plan={plan} stacked />
    case "horizontal_bar":
    case "lollipop":
      return <BarChartView rows={rows} plan={plan} horizontal />
    case "diverging_bar":
      return <DivergingBarChartView rows={rows} plan={plan} />
    case "composed":
      return <ComposedChartView rows={rows} plan={plan} />
    case "histogram":
    case "box_plot":
      return <HistogramChartView rows={rows} plan={plan} />
    case "scatter":
      return <ScatterChartView rows={rows} plan={plan} />
    case "bubble":
      return <ScatterChartView rows={rows} plan={plan} bubble />
    case "pie":
      return <PieChartView rows={rows} plan={plan} />
    case "donut":
      return <PieChartView rows={rows} plan={plan} donut />
    case "treemap":
      return <TreemapChartView rows={rows} plan={plan} />
    case "radar":
      return <RadarChartView rows={rows} plan={plan} />
    case "funnel":
      return <FunnelChartView rows={rows} plan={plan} />
    case "waterfall":
      return <WaterfallChartView rows={rows} plan={plan} />
    case "heatmap":
    case "calendar_heatmap":
      return <HeatmapChartView rows={rows} plan={plan} />
    case "bullet":
    case "change_bar":
      return <DivergingBarChartView rows={rows} plan={plan} />
    case "small_multiples":
      return <LineChartView rows={rows} plan={plan} />
    case "sparkline":
      return <LineChartView rows={rows} plan={{ ...plan, options: { height: 80 } }} />
  }

  return <LineChartView rows={rows} plan={plan} />
}
