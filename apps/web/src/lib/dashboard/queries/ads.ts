import "server-only"

import { runCubeQuery } from "../cube-query"
import { istDateRange, LAST_30_DAYS, priorIstDateRange } from "../date-ranges"

export interface AdsDashboardData {
  spendRoasDaily: Record<string, unknown>[]
  impressionsClicks: Record<string, unknown>[]
  cpcCpmCpaCurrent: Record<string, unknown>[]
  cpcCpmCpaPrior: Record<string, unknown>[]
  topCampaignsRoas: Record<string, unknown>[]
  adsetTable: Record<string, unknown>[]
  purchaseFunnel: Record<string, unknown>[]
  spendByHour: Record<string, unknown>[]
  attributionByCampaign: Record<string, unknown>[]
  engagementPeriod: Record<string, unknown>[]
  engagementDaily: Record<string, unknown>[]
}

function td(dim: string, days: number, granularity?: "day") {
  const dateRange = days === 30 ? LAST_30_DAYS : istDateRange(days)
  return { dimension: dim, ...(granularity ? { granularity } : {}), dateRange }
}

export async function fetchAdsDashboardData(days = 30): Promise<AdsDashboardData> {
  const [
    spendRoasDaily,
    impressionsClicks,
    cpcCpmCpaCurrent,
    cpcCpmCpaPrior,
    topCampaignsRoas,
    adsetTable,
    purchaseFunnel,
    spendByHour,
    attributionByCampaign,
    engagementPeriod,
    engagementDaily,
  ] = await Promise.all([
    runCubeQuery({
      measures: [
        "marketing_performance.ad_spend",
        "marketing_performance.roas",
        "marketing_performance.purchase_value",
        "marketing_performance.purchases",
      ],
      timeDimensions: [td("marketing_performance.date_start", days, "day")],
      order: { "marketing_performance.date_start": "asc" },
    }),
    runCubeQuery({
      measures: [
        "marketing_performance.impressions",
        "marketing_performance.clicks",
        "marketing_performance.ctr",
        "marketing_performance.cpc",
      ],
      timeDimensions: [td("marketing_performance.date_start", days, "day")],
      order: { "marketing_performance.date_start": "asc" },
    }),
    runCubeQuery({
      measures: [
        "marketing_performance.cpc",
        "marketing_performance.cpm",
        "marketing_performance.ad_spend",
        "marketing_performance.purchases",
        "marketing_performance.conversion_rate",
      ],
      timeDimensions: [td("marketing_performance.date_start", days)],
    }),
    runCubeQuery({
      measures: [
        "marketing_performance.cpc",
        "marketing_performance.cpm",
        "marketing_performance.ad_spend",
        "marketing_performance.purchases",
        "marketing_performance.conversion_rate",
      ],
      timeDimensions: [
        {
          dimension: "marketing_performance.date_start",
          dateRange: days === 30 ? priorIstDateRange(30) : priorIstDateRange(days),
        },
      ],
    }),
    runCubeQuery({
      dimensions: ["marketing_performance.campaign_name"],
      measures: [
        "marketing_performance.roas",
        "marketing_performance.ad_spend",
        "marketing_performance.purchase_value",
        "marketing_performance.purchases",
        "marketing_performance.cpc",
      ],
      timeDimensions: [td("marketing_performance.date_start", days)],
      order: { "marketing_performance.roas": "desc" },
      limit: 10,
    }),
    runCubeQuery({
      dimensions: [
        "marketing_performance.campaign_name",
        "marketing_performance.adset_name",
      ],
      measures: [
        "marketing_performance.ad_spend",
        "marketing_performance.roas",
        "marketing_performance.ctr",
        "marketing_performance.cpc",
        "marketing_performance.cpm",
        "marketing_performance.purchases",
        "marketing_performance.purchase_value",
        "marketing_performance.impressions",
        "marketing_performance.clicks",
        "marketing_performance.conversion_rate",
      ],
      timeDimensions: [td("marketing_performance.date_start", days)],
      order: { "marketing_performance.ad_spend": "desc" },
      limit: 50,
    }),
    runCubeQuery({
      measures: [
        "marketing_performance.impressions",
        "marketing_performance.link_clicks",
        "marketing_performance.landing_page_views",
        "marketing_performance.add_to_carts",
        "marketing_performance.initiated_checkouts",
        "marketing_performance.purchases",
      ],
      timeDimensions: [td("marketing_performance.date_start", days)],
    }),
    runCubeQuery({
      dimensions: ["ad_performance.hourly_window"],
      measures: [
        "ad_performance.ad_spend",
        "ad_performance.roas",
        "ad_performance.purchases",
        "ad_performance.impressions",
      ],
      timeDimensions: [td("ad_performance.date_start", days)],
      order: { "ad_performance.hourly_window": "asc" },
    }),
    runCubeQuery({
      dimensions: ["dw_meta_ads_attribution.campaign_name"],
      measures: [
        "dw_meta_ads_attribution.attributed_revenue",
        "dw_meta_ads_attribution.attributed_orders",
        "dw_meta_ads_attribution.attributed_cogs",
        "dw_meta_ads_attribution.attributed_gross_profit",
        "dw_meta_ads_attribution.roas",
      ],
      timeDimensions: [td("dw_meta_ads_attribution.date_start", days)],
      order: { "dw_meta_ads_attribution.attributed_revenue": "desc" },
      limit: 15,
    }),
    runCubeQuery({
      measures: [
        "ad_performance.video_views",
        "ad_performance.post_engagements",
        "ad_performance.link_clicks",
        "ad_performance.landing_page_views",
        "ad_performance.add_to_carts",
      ],
      timeDimensions: [td("ad_performance.date_start", days)],
    }),
    runCubeQuery({
      measures: [
        "ad_performance.video_views",
        "ad_performance.post_engagements",
        "ad_performance.link_clicks",
        "ad_performance.landing_page_views",
        "ad_performance.add_to_carts",
      ],
      timeDimensions: [td("ad_performance.date_start", days, "day")],
      order: { "ad_performance.date_start": "asc" },
    }),
  ])

  return {
    spendRoasDaily,
    impressionsClicks,
    cpcCpmCpaCurrent,
    cpcCpmCpaPrior,
    topCampaignsRoas,
    adsetTable,
    purchaseFunnel,
    spendByHour,
    attributionByCampaign,
    engagementPeriod,
    engagementDaily,
  }
}
