import "server-only"

import { runCubeQuery } from "../cube-query"
import { istDateRange, LAST_30_DAYS } from "../date-ranges"

export interface ShopifyDashboardData {
  revenueOrdersDaily: Record<string, unknown>[]
  topProducts: Record<string, unknown>[]
  returnCancel: Record<string, unknown>[]
  revenueByGeo: Record<string, unknown>[]
  utmBreakdown: Record<string, unknown>[]
  discountImpact: Record<string, unknown>[]
  unitsPerOrder: Record<string, unknown>[]
  fulfillmentMix: Record<string, unknown>[]
  marginBySku: Record<string, unknown>[]
  shippingRevenue: Record<string, unknown>[]
}

function td(dim: string, days: number, granularity?: "day") {
  const dateRange = days === 30 ? LAST_30_DAYS : istDateRange(days)
  return { dimension: dim, ...(granularity ? { granularity } : {}), dateRange }
}

export async function fetchShopifyDashboardData(days = 30): Promise<ShopifyDashboardData> {
  const [
    revenueOrdersDaily,
    topProducts,
    returnCancel,
    revenueByGeo,
    utmBreakdown,
    discountImpact,
    unitsPerOrder,
    fulfillmentMix,
    marginBySku,
    shippingRevenue,
  ] = await Promise.all([
    runCubeQuery({
      measures: [
        "shopify_orders.gross_revenue",
        "shopify_orders.net_sales_ex_gst",
        "shopify_orders.net_orders",
        "shopify_orders.aov",
      ],
      timeDimensions: [td("shopify_orders.created_at_ist", days, "day")],
      order: { "shopify_orders.created_at_ist": "asc" },
    }),
    runCubeQuery({
      dimensions: ["product_performance.product_title"],
      measures: [
        "product_performance.gross_line_revenue_ex_gst",
        "product_performance.net_line_revenue_ex_gst",
        "product_performance.total_quantity",
        "product_performance.gross_profit_ex_gst",
        "product_performance.total_cogs",
      ],
      timeDimensions: [td("product_performance.created_at_ist", days)],
      order: { "product_performance.net_line_revenue_ex_gst": "desc" },
      limit: 15,
    }),
    runCubeQuery({
      dimensions: ["product_performance.product_title"],
      measures: [
        "product_performance.returned_units",
        "product_performance.cancelled_units",
        "product_performance.total_quantity",
        "product_performance.total_line_discounts",
      ],
      timeDimensions: [td("product_performance.created_at_ist", days)],
      order: { "product_performance.returned_units": "desc" },
      limit: 20,
    }),
    runCubeQuery({
      dimensions: ["shopify_orders.ship_country", "shopify_orders.ship_province"],
      measures: [
        "shopify_orders.gross_revenue",
        "shopify_orders.net_orders",
        "shopify_orders.aov",
      ],
      timeDimensions: [td("shopify_orders.created_at_ist", days)],
      order: { "shopify_orders.gross_revenue": "desc" },
      limit: 50,
    }),
    runCubeQuery({
      dimensions: [
        "shopify_orders.utm_source",
        "shopify_orders.utm_medium",
        "shopify_orders.utm_campaign",
      ],
      measures: [
        "shopify_orders.gross_revenue",
        "shopify_orders.net_orders",
        "shopify_orders.aov",
      ],
      timeDimensions: [td("shopify_orders.created_at_ist", days)],
      order: { "shopify_orders.gross_revenue": "desc" },
      limit: 30,
    }),
    runCubeQuery({
      measures: [
        "shopify_order_line_items.total_line_discounts",
        "shopify_order_line_items.net_line_revenue_ex_gst",
        "shopify_order_line_items.gross_profit_ex_gst",
        "shopify_order_line_items.total_cogs",
        "shopify_order_line_items.avg_unit_price",
        "shopify_order_line_items.avg_discounted_unit_price",
      ],
      timeDimensions: [td("shopify_order_line_items.created_at_ist", days, "day")],
      order: { "shopify_order_line_items.created_at_ist": "asc" },
    }),
    runCubeQuery({
      measures: [
        "shopify_order_line_items.units_per_order",
        "shopify_order_line_items.avg_unit_price",
        "shopify_order_line_items.avg_discounted_unit_price",
        "shopify_order_line_items.unique_products",
      ],
      timeDimensions: [td("shopify_order_line_items.created_at_ist", days, "day")],
      order: { "shopify_order_line_items.created_at_ist": "asc" },
    }),
    runCubeQuery({
      dimensions: ["shopify_orders.fulfillment_status"],
      measures: ["shopify_orders.orders", "shopify_orders.gross_revenue"],
      timeDimensions: [td("shopify_orders.created_at_ist", days)],
      order: { "shopify_orders.orders": "desc" },
    }),
    runCubeQuery({
      dimensions: ["product_performance.sku", "product_performance.product_title"],
      measures: [
        "product_performance.gross_profit_ex_gst",
        "product_performance.total_cogs",
        "product_performance.net_line_revenue_ex_gst",
        "product_performance.avg_unit_price",
        "product_performance.avg_discounted_unit_price",
        "product_performance.total_quantity",
      ],
      timeDimensions: [td("product_performance.created_at_ist", days)],
      order: { "product_performance.gross_profit_ex_gst": "desc" },
      limit: 20,
    }),
    runCubeQuery({
      measures: [
        "shopify_orders.gross_revenue",
        "shopify_orders.shipping_revenue",
        "shopify_orders.net_sales_ex_gst",
        "shopify_orders.orders_with_shipping",
      ],
      timeDimensions: [td("shopify_orders.created_at_ist", days, "day")],
      order: { "shopify_orders.created_at_ist": "asc" },
    }),
  ])

  return {
    revenueOrdersDaily,
    topProducts,
    returnCancel,
    revenueByGeo,
    utmBreakdown,
    discountImpact,
    unitsPerOrder,
    fulfillmentMix,
    marginBySku,
    shippingRevenue,
  }
}
