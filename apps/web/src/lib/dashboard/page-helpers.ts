import { wideRowToSlices } from "./transforms"

export const CHANNEL_REVENUE_SLICES = [
  { label: "Meta", measure: "channel_pnl.meta_attributed_revenue_ex_gst" },
  { label: "Google", measure: "channel_pnl.google_attributed_revenue_ex_gst" },
  { label: "Organic", measure: "channel_pnl.organic_attributed_revenue_ex_gst" },
] as const

export const CHANNEL_NET_PROFIT_SERIES = [
  { label: "Meta", measure: "channel_pnl.meta_net_profit" },
  { label: "Google", measure: "channel_pnl.google_net_profit" },
  { label: "Organic", measure: "channel_pnl.organic_net_profit" },
] as const

/** marketing_performance funnel — link_clicks after impressions (not clicks). */
export const FUNNEL_STEPS = [
  { label: "Impressions", measure: "marketing_performance.impressions" },
  { label: "Link clicks", measure: "marketing_performance.link_clicks" },
  { label: "Landing page views", measure: "marketing_performance.landing_page_views" },
  { label: "Add to carts", measure: "marketing_performance.add_to_carts" },
  { label: "Initiated checkouts", measure: "marketing_performance.initiated_checkouts" },
  { label: "Purchases", measure: "marketing_performance.purchases" },
] as const

export function channelRevenueSlices(row: Record<string, unknown>) {
  return wideRowToSlices(row, [...CHANNEL_REVENUE_SLICES])
}

export function funnelFromAggregate(row: Record<string, unknown>) {
  return FUNNEL_STEPS.map(({ label, measure }) => ({
    name: label,
    value: Number(row[measure] ?? 0),
  }))
}

/** P&L waterfall from period-aggregate daily_pnl row (canonical formula). */
export function pnlWaterfallSteps(row: Record<string, unknown>) {
  const sales = Number(row["daily_pnl.total_sales_ex_gst"] ?? 0)
  const cogs = Number(row["daily_pnl.total_cogs"] ?? 0)
  const gross = Number(row["daily_pnl.gross_profit"] ?? 0)
  const spend = Number(row["daily_pnl.total_ad_spend"] ?? 0)
  const net = Number(row["daily_pnl.net_profit"] ?? 0)

  return [
    { name: "Sales ex GST", value: sales, kind: "start" as const },
    { name: "COGS", value: -cogs, kind: "delta" as const },
    { name: "Gross profit", value: gross, kind: "subtotal" as const },
    { name: "Ad spend", value: -spend, kind: "delta" as const },
    { name: "Net profit", value: net, kind: "total" as const },
  ]
}

export function geoLabel(row: Record<string, unknown>) {
  const country = String(row["shopify_orders.ship_country"] ?? "")
  const province = String(row["shopify_orders.ship_province"] ?? "")
  return province ? `${country} · ${province}` : country || "Unknown"
}

export function utmLabel(row: Record<string, unknown>) {
  const src = String(row["shopify_orders.utm_source"] ?? "direct")
  const med = String(row["shopify_orders.utm_medium"] ?? "")
  return med ? `${src} / ${med}` : src
}

export function skuLabel(row: Record<string, unknown>) {
  const sku = String(row["product_performance.sku"] ?? "")
  const title = String(row["product_performance.product_title"] ?? "")
  return title ? `${sku} · ${title}` : sku
}
