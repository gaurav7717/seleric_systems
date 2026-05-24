import { NextResponse } from "next/server"
import { callCubeTool } from "@/lib/cube-client"
import type { RawSkuRow, RawCampaignRow } from "@/lib/campaign-sku-matcher"

function extractRows(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[]
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>
    if (Array.isArray(obj.data)) return obj.data as Record<string, unknown>[]
  }
  return []
}

function num(v: unknown): number {
  const n = Number(v)
  return isFinite(n) ? n : 0
}

function normalizeDateRange(from: string, to: string): { from: string; to: string } {
  if (from <= to) return { from, to }
  return { from: to, to: from }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const rawFrom = url.searchParams.get("dateFrom") ?? "2025-01-01"
  const rawTo = url.searchParams.get("dateTo") ?? new Date().toISOString().slice(0, 10)
  const { from: dateFrom, to: dateTo } = normalizeDateRange(rawFrom, rawTo)

  try {
    const [skuRaw, campaignRaw] = await Promise.all([
      // SKU data: COGS + quantity + revenue + ASP + returns
      callCubeTool("cube_query", {
        query: {
          dimensions: [
            "shopify_order_line_items.sku",
            "shopify_order_line_items.product_title",
          ],
          measures: [
            "shopify_order_line_items.total_quantity",
            "shopify_order_line_items.effective_unit_cost_avg",
            "shopify_order_line_items.avg_unit_price",
            "shopify_order_line_items.gross_line_revenue",
            "shopify_order_line_items.gross_line_revenue_ex_gst",
          ],
          timeDimensions: [
            {
              dimension: "shopify_order_line_items.created_at_ist",
              dateRange: [dateFrom, dateTo],
            },
          ],
          order: { "shopify_order_line_items.total_quantity": "desc" },
          limit: 500,
          timezone: "Asia/Kolkata",
        },
      }),
      // Campaign ad spend + purchases grouped by campaign name
      callCubeTool("cube_query", {
        query: {
          dimensions: ["ad_performance.campaign_name"],
          measures: ["ad_performance.ad_spend", "ad_performance.purchases"],
          timeDimensions: [
            {
              dimension: "ad_performance.date_start",
              dateRange: [dateFrom, dateTo],
            },
          ],
          order: { "ad_performance.ad_spend": "desc" },
          limit: 500,
          timezone: "Asia/Kolkata",
        },
      }),
    ])

    // --- SKUs ---
    const skuRows = extractRows(skuRaw)
    const skus: RawSkuRow[] = skuRows
      .filter((r) => r["shopify_order_line_items.sku"])
      .map((r) => {
        const asp = num(r["shopify_order_line_items.avg_unit_price"])
        return {
          sku: String(r["shopify_order_line_items.sku"]),
          productTitle: String(r["shopify_order_line_items.product_title"] ?? ""),
          qty: num(r["shopify_order_line_items.total_quantity"]),
          unitCost: num(r["shopify_order_line_items.effective_unit_cost_avg"]),
          asp: asp > 0 ? asp : null,
          grossRevenue: num(r["shopify_order_line_items.gross_line_revenue"]),
          netRevenueExGst: num(r["shopify_order_line_items.gross_line_revenue_ex_gst"]),
        }
      })

    // --- Campaigns ---
    const campaignRows = extractRows(campaignRaw)
    const campaigns: RawCampaignRow[] = campaignRows
      .filter((r) => r["ad_performance.campaign_name"])
      .map((r) => ({
        campaignName: String(r["ad_performance.campaign_name"]),
        spend: num(r["ad_performance.ad_spend"]),
        purchases: num(r["ad_performance.purchases"]),
      }))

    return NextResponse.json({ skus, campaigns })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
