export type ColumnRole =
  | "date"
  | "category"
  | "metric"
  | "currency"
  | "count"
  | "rate"
  | "ratio"
  | "signed"
  | "id"
  | "unknown"

export type MetricRole = "revenue" | "spend" | "profit" | "cost" | "orders" | "cac" | "ltv" | "generic"

export type ChartKind =
  | "line"
  | "area"
  | "stacked_area"
  | "percent_area"
  | "step_line"
  | "dual_line"
  | "bar_trend"
  | "grouped_bar_trend"
  | "sparkline"
  | "cumulative_line"
  | "bar"
  | "grouped_bar"
  | "stacked_bar"
  | "horizontal_bar"
  | "diverging_bar"
  | "lollipop"
  | "waterfall"
  | "bullet"
  | "change_bar"
  | "histogram"
  | "box_plot"
  | "scatter"
  | "bubble"
  | "pie"
  | "donut"
  | "treemap"
  | "heatmap"
  | "calendar_heatmap"
  | "radar"
  | "funnel"
  | "composed"
  | "pnl_dashboard"
  | "small_multiples"
  | "summary_kpi"
  | "table"

export type InsightLayout =
  | "summary_kpi"
  | "pnl_dashboard"
  | "multi_chart"
  | "single_chart"
  | "table_only"

export type ChartSeries = {
  key: string
  label: string
  role?: MetricRole
  axis?: "left" | "right"
  strokeDasharray?: string
}

export type ChartPlanOptions = {
  stacked?: boolean
  diverging?: boolean
  horizontal?: boolean
  percent?: boolean
  height?: number
}

export type ChartPlan = {
  kind: ChartKind
  title?: string
  xKey: string
  labelKey?: string
  series: ChartSeries[]
  options?: ChartPlanOptions
}

export type ColumnInfo = {
  key: string
  role: ColumnRole
  metricRole?: MetricRole
}

export type DataProfile = {
  columns: ColumnInfo[]
  dateKey: string | null
  categoryKey: string | null
  metricKeys: string[]
  rowCount: number
}

export type NormalizedRow = Record<string, string | number | null>

export type PeriodSummary = Record<string, number | null>
