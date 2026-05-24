/** Canonical KPI measures for dashboard #01 — matches seleric_queries_reference.md */
export const PNL_KPI_MEASURES = [
  "daily_pnl.net_profit",
  "daily_pnl.gross_profit",
  "daily_pnl.total_sales_ex_gst",
  "daily_pnl.total_cogs",
  "daily_pnl.total_ad_spend",
  "daily_pnl.total_orders",
  "daily_pnl.gross_margin_pct",
] as const

export const PNL_KPI_LABELS: Record<(typeof PNL_KPI_MEASURES)[number], string> = {
  "daily_pnl.net_profit": "Net profit",
  "daily_pnl.gross_profit": "Gross profit",
  "daily_pnl.total_sales_ex_gst": "Sales ex GST",
  "daily_pnl.total_cogs": "COGS",
  "daily_pnl.total_ad_spend": "Ad spend",
  "daily_pnl.total_orders": "Orders",
  "daily_pnl.gross_margin_pct": "Gross margin %",
}
