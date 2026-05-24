import "server-only"

import { runCubeQuery, runCubeToolRows } from "../cube-query"
import { istDateRange, LAST_30_DAYS } from "../date-ranges"

export interface MainDashboardData {
  kpiTodayYesterday: Record<string, unknown>[]
  netProfitTrend: Record<string, unknown>[]
  revenueVsSpend: Record<string, unknown>[]
  channelRevenue: Record<string, unknown>[]
  channelNetProfitTrend: Record<string, unknown>[]
  ordersAovTrend: Record<string, unknown>[]
  roasByChannel: Record<string, unknown>[]
  grossMarginTrend: Record<string, unknown>[]
  returnRateTrend: Record<string, unknown>[]
  pnlWaterfall: Record<string, unknown>[]
}

function td(dim: string, days: number, granularity?: "day") {
  const dateRange = days === 30 ? LAST_30_DAYS : istDateRange(days)
  return { dimension: dim, ...(granularity ? { granularity } : {}), dateRange }
}

export async function fetchMainDashboardData(days = 30): Promise<MainDashboardData> {
  const [
    kpiTodayYesterday,
    netProfitTrend,
    revenueVsSpend,
    channelRevenue,
    channelNetProfitTrend,
    ordersAovTrend,
    roasByChannel,
    grossMarginTrend,
    returnRateTrend,
    pnlWaterfall,
  ] = await Promise.all([
    runCubeToolRows("cube_pnl_today_yesterday", {}),
    runCubeQuery({
      measures: ["daily_pnl.net_profit", "daily_pnl.gross_profit"],
      timeDimensions: [td("daily_pnl.report_date", days, "day")],
      order: { "daily_pnl.report_date": "asc" },
    }),
    runCubeQuery({
      measures: [
        "daily_pnl.total_sales_ex_gst",
        "daily_pnl.total_cogs",
        "daily_pnl.total_ad_spend",
        "daily_pnl.net_profit",
      ],
      timeDimensions: [td("daily_pnl.report_date", days, "day")],
      order: { "daily_pnl.report_date": "asc" },
    }),
    runCubeQuery({
      measures: [
        "channel_pnl.meta_attributed_revenue_ex_gst",
        "channel_pnl.google_attributed_revenue_ex_gst",
        "channel_pnl.organic_attributed_revenue_ex_gst",
        "channel_pnl.meta_attributed_orders",
        "channel_pnl.google_attributed_orders",
        "channel_pnl.organic_attributed_orders",
      ],
      timeDimensions: [td("channel_pnl.date_start", days)],
    }),
    runCubeQuery({
      measures: [
        "channel_pnl.meta_net_profit",
        "channel_pnl.google_net_profit",
        "channel_pnl.organic_net_profit",
      ],
      timeDimensions: [td("channel_pnl.date_start", days, "day")],
      order: { "channel_pnl.date_start": "asc" },
    }),
    runCubeQuery({
      measures: [
        "shopify_orders.net_orders",
        "shopify_orders.aov",
        "shopify_orders.gross_revenue",
      ],
      timeDimensions: [td("shopify_orders.created_at_ist", days, "day")],
      order: { "shopify_orders.created_at_ist": "asc" },
    }),
    runCubeQuery({
      measures: [
        "channel_pnl.meta_roas",
        "channel_pnl.google_roas",
        "channel_pnl.meta_ad_spend",
        "channel_pnl.google_ad_spend",
      ],
      timeDimensions: [td("channel_pnl.date_start", days, "day")],
      order: { "channel_pnl.date_start": "asc" },
    }),
    runCubeQuery({
      measures: [
        "daily_pnl.gross_margin_pct",
        "daily_pnl.gross_profit",
        "daily_pnl.total_sales_ex_gst",
      ],
      timeDimensions: [td("daily_pnl.report_date", days, "day")],
      order: { "daily_pnl.report_date": "asc" },
    }),
    runCubeQuery({
      measures: [
        "shopify_orders.return_rate",
        "shopify_orders.returned_orders",
        "shopify_orders.net_orders",
      ],
      timeDimensions: [td("shopify_orders.created_at_ist", days, "day")],
      order: { "shopify_orders.created_at_ist": "asc" },
    }),
    runCubeQuery({
      measures: [
        "daily_pnl.total_sales_ex_gst",
        "daily_pnl.total_cogs",
        "daily_pnl.gross_profit",
        "daily_pnl.total_ad_spend",
        "daily_pnl.net_profit",
      ],
      timeDimensions: [td("daily_pnl.report_date", days)],
    }),
  ])

  return {
    kpiTodayYesterday,
    netProfitTrend,
    revenueVsSpend,
    channelRevenue,
    channelNetProfitTrend,
    ordersAovTrend,
    roasByChannel,
    grossMarginTrend,
    returnRateTrend,
    pnlWaterfall,
  }
}
