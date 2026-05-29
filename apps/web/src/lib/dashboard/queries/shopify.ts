import "server-only"

import { runCubeQuery } from "../cube-query"
import { toCubeDateRange, type DashboardDateRange } from "../date-ranges"

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

function td(dim: string, range: DashboardDateRange, granularity?: "day") {
  return { dimension: dim, ...(granularity ? { granularity } : {}), dateRange: toCubeDateRange(range) }
}

async function safeQuery(query: Parameters<typeof runCubeQuery>[0], label: string): Promise<Record<string, unknown>[]> {
  try {
    return await runCubeQuery(query)
  } catch (e) {
    console.error(`[shopify] query failed: ${label}`, e)
    return []
  }
}

export async function fetchShopifyDashboardData(range: DashboardDateRange): Promise<ShopifyDashboardData> {
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
    safeQuery({
      measures: [
        "shopify_orders.gross_revenue",
        "shopify_orders.net_orders",
        "shopify_orders.aov",
      ],
      timeDimensions: [td("shopify_orders.created_at_ist", range, "day")],
      order: { "shopify_orders.created_at_ist": "asc" },
    }, "revenueOrdersDaily"),
    // product_performance + product dimensions = nested aggregate error in Cube.
    // Use shopify_order_line_items.total_quantity (only safe product-dimension measure).
    safeQuery({
      dimensions: ["shopify_order_line_items.product_title"],
      measures: ["shopify_order_line_items.total_quantity"],
      timeDimensions: [td("shopify_order_line_items.created_at_ist", range)],
      order: { "shopify_order_line_items.total_quantity": "desc" },
      limit: 15,
    }, "topProducts"),
    safeQuery({
      measures: [
        "shopify_orders.return_rate",
        "shopify_orders.returned_orders",
        "shopify_orders.net_orders",
      ],
      timeDimensions: [td("shopify_orders.created_at_ist", range, "day")],
      order: { "shopify_orders.created_at_ist": "asc" },
    }, "returnCancel"),
    safeQuery({
      dimensions: ["shopify_orders.ship_country", "shopify_orders.ship_province"],
      measures: [
        "shopify_orders.gross_revenue",
        "shopify_orders.net_orders",
        "shopify_orders.aov",
      ],
      timeDimensions: [td("shopify_orders.created_at_ist", range)],
      order: { "shopify_orders.gross_revenue": "desc" },
      limit: 50,
    }, "revenueByGeo"),
    safeQuery({
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
      timeDimensions: [td("shopify_orders.created_at_ist", range)],
      order: { "shopify_orders.gross_revenue": "desc" },
      limit: 30,
    }, "utmBreakdown"),
    safeQuery({
      measures: [
        "shopify_order_line_items.total_line_discounts",
        "shopify_order_line_items.net_line_revenue_ex_gst",
        "shopify_order_line_items.avg_unit_price",
        "shopify_order_line_items.avg_discounted_unit_price",
      ],
      timeDimensions: [td("shopify_order_line_items.created_at_ist", range, "day")],
      order: { "shopify_order_line_items.created_at_ist": "asc" },
    }, "discountImpact"),
    safeQuery({
      measures: [
        "shopify_order_line_items.units_per_order",
        "shopify_order_line_items.avg_unit_price",
        "shopify_order_line_items.avg_discounted_unit_price",
        "shopify_order_line_items.unique_products",
      ],
      timeDimensions: [td("shopify_order_line_items.created_at_ist", range, "day")],
      order: { "shopify_order_line_items.created_at_ist": "asc" },
    }, "unitsPerOrder"),
    safeQuery({
      dimensions: ["shopify_orders.fulfillment_status"],
      measures: ["shopify_orders.orders", "shopify_orders.gross_revenue"],
      timeDimensions: [td("shopify_orders.created_at_ist", range)],
      order: { "shopify_orders.orders": "desc" },
    }, "fulfillmentMix"),
    // product_performance + sku/product_title dimensions also hit nested aggregate.
    // Use shopify_order_line_items with sku + product_title (only quantity is safe).
    safeQuery({
      dimensions: ["shopify_order_line_items.sku", "shopify_order_line_items.product_title"],
      measures: ["shopify_order_line_items.total_quantity"],
      timeDimensions: [td("shopify_order_line_items.created_at_ist", range)],
      order: { "shopify_order_line_items.total_quantity": "desc" },
      limit: 20,
    }, "marginBySku"),
    safeQuery({
      measures: [
        "shopify_orders.gross_revenue",
        "shopify_orders.shipping_revenue",
        "shopify_orders.orders_with_shipping",
      ],
      timeDimensions: [td("shopify_orders.created_at_ist", range, "day")],
      order: { "shopify_orders.created_at_ist": "asc" },
    }, "shippingRevenue"),
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
