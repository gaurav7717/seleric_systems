import { callCubeTool } from "@/lib/cube-client"
import { extractRows, type CubeRow } from "./cube-rows"

// Fallback when schema is unavailable. The preferred path is to derive
// these from the live SchemaCache via createPnlTools(schema).
export const PNL_MEASURES = [
  "daily_pnl.gross_revenue",
  "daily_pnl.total_sales_ex_gst",
  "daily_pnl.total_cogs",
  "daily_pnl.gross_profit",
  "daily_pnl.total_ad_spend",
  "daily_pnl.net_profit",
  "daily_pnl.total_orders",
] as const

export const IST_TIMEZONE = "Asia/Kolkata"

export function enrichPnlRows(rows: CubeRow[]): CubeRow[] {
  return rows.map((row) => {
    const spend = Number(row["daily_pnl.total_ad_spend"] ?? 0)
    const orders = Number(row["daily_pnl.total_orders"] ?? 0)
    const cac = orders > 0 ? spend / orders : null
    return { ...row, "derived.cac": cac }
  })
}

function rowMatchesMetrics(key: string, metrics: string[]): boolean {
  const kl = key.toLowerCase()
  return metrics.some((m) => {
    const ml = m.toLowerCase()
    if (kl.includes(ml)) return true
    if ((ml === "revenue" || ml === "sales") && (kl.includes("sales") || kl.includes("revenue"))) return true
    if ((ml === "spend" || ml === "ad_spend") && kl.includes("spend")) return true
    if (ml === "profit" && kl.includes("profit")) return true
    return false
  })
}

export async function fetchDailyPnl(
  startDate: string,
  endDate: string,
  groupByDay: boolean,
  metricsFilter?: string[]
): Promise<CubeRow[]> {
  const raw = await callCubeTool("cube_daily_pnl", {
    start_date: startDate,
    end_date: endDate,
    group_by_day: groupByDay,
  })
  const rows = enrichPnlRows(extractRows(raw))
  if (!metricsFilter?.length) return rows
  return rows.map((row) => {
    const out: CubeRow = {}
    for (const [k, v] of Object.entries(row)) {
      if (/report_date|\.day$|\.week$|\.month$/i.test(k)) { out[k] = v; continue }
      if (rowMatchesMetrics(k, metricsFilter)) out[k] = v
    }
    return out
  })
}

export type PnlGranularity = "day" | "week" | "month"

export async function fetchPnlTrend(
  startDate: string,
  endDate: string,
  granularity: PnlGranularity,
  measures: readonly string[] = PNL_MEASURES
): Promise<CubeRow[]> {
  const raw = await callCubeTool("cube_query", {
    query: {
      measures: [...measures],
      timeDimensions: [
        {
          dimension: "daily_pnl.report_date",
          granularity,
          dateRange: [startDate, endDate],
        },
      ],
      timezone: IST_TIMEZONE,
      order: { "daily_pnl.report_date": "asc" },
    },
  })
  return enrichPnlRows(extractRows(raw))
}

const CHANNEL_FIELDS = {
  Meta: {
    revenue: "channel_pnl.meta_attributed_revenue",
    adSpend: "channel_pnl.meta_ad_spend",
    netProfit: "channel_pnl.meta_net_profit",
    orders: "channel_pnl.meta_attributed_orders",
  },
  Google: {
    revenue: "channel_pnl.google_attributed_revenue",
    adSpend: "channel_pnl.google_ad_spend",
    netProfit: "channel_pnl.google_net_profit",
    orders: "channel_pnl.google_attributed_orders",
  },
  Organic: {
    revenue: "channel_pnl.organic_attributed_revenue",
    adSpend: null,
    netProfit: "channel_pnl.organic_net_profit",
    orders: "channel_pnl.organic_attributed_orders",
  },
} as const

export function wideChannelRowToChartRows(wide: CubeRow) {
  return (Object.entries(CHANNEL_FIELDS) as [keyof typeof CHANNEL_FIELDS, (typeof CHANNEL_FIELDS)[keyof typeof CHANNEL_FIELDS]][]).map(
    ([channel, fields]) => ({
      channel,
      revenue: Number(wide[fields.revenue] ?? 0),
      adSpend: fields.adSpend ? Number(wide[fields.adSpend] ?? 0) : 0,
      netProfit: Number(wide[fields.netProfit] ?? 0),
      orders: Number(wide[fields.orders] ?? 0),
    })
  )
}

export async function fetchChannelBreakdown(startDate: string, endDate: string): Promise<CubeRow[]> {
  const raw = await callCubeTool("cube_channel_pnl", {
    start_date: startDate,
    end_date: endDate,
  })
  const rows = extractRows(raw)
  if (!rows.length) return []
  return wideChannelRowToChartRows(rows[0])
}
