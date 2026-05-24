/**
 * Domain knowledge about the Seleric Cube semantic layer.
 * Encodes cube routing rules and critical gotchas that cannot be derived
 * from the schema alone -- sourced from docs/seleric_queries_reference.md.
 */

export function getCubeDomainInstructions(): string {
  return `## Cube routing -- which cube to use

| Question type | Cube to use | Key rule |
|---|---|---|
| Net profit, gross profit, COGS, total ad spend | \`daily_pnl\` | Canonical source. Never recompute manually. |
| Meta vs Google vs Organic channel split | \`channel_pnl\` | Channel cards only; company total still from \`daily_pnl\`. |
| Meta campaign/adset ROAS, CTR, CPC, CPM, funnel | \`marketing_performance\` | Correct spend source for delivery metrics. |
| Hourly breakdown, hour-of-day patterns | \`ad_performance\` | Only cube with \`hourly_window\` dimension. |
| Revenue/orders attributed to Meta per campaign | \`dw_meta_ads_attribution\` | Do NOT use \`ad_spend\` from here for company totals. |
| Orders, AOV, geography, UTM, fulfillment | \`shopify_orders\` | Always \`created_at_ist\`, never \`created_at\`. |
| Line-item discounts, units per order, per-item COGS | \`shopify_order_line_items\` | Use \`created_at_ist\` for time filter. |
| SKU-level revenue, margin, returns | \`product_performance\` | \`gross_profit_ex_gst = net_line_revenue_ex_gst - total_cogs\`. |

## Net profit canonical formula

\`\`\`
daily_pnl.net_profit = total_sales_ex_gst - total_cogs - total_ad_spend
\`\`\`

- \`total_ad_spend\` = Meta ads_insights_hourly + Google -- NOT the attribution tables
- Never stitch \`shopify_orders.gross_revenue - dw_meta_ads_attribution.ad_spend\` -- inflates profit by tens of thousands
- Always use \`daily_pnl.net_profit\` or the \`getDailyPnl\`/\`getPnlTrend\` tools for any P&L question

## Critical gotchas -- will produce wrong results without these

**Return rate / returned orders**
- \`returned_orders\` = \`return_status IN ('RETURNED', 'IN_PROGRESS')\` only
- Do NOT filter \`return_status IS NOT NULL\` -- Shopify sets it to \`NO_RETURN\` on ~98% of normal orders, inflating return rate to nearly 100%
- \`shopify_orders.return_rate\` and \`product_performance.returned_units\` are pre-filtered correctly -- use them directly, do not add an extra \`return_status\` filter

**Timezone**
- Shopify order dates: always use \`shopify_orders.created_at_ist\` or \`shopify_order_line_items.created_at_ist\` -- never \`created_at\` (UTC)
- \`daily_pnl.report_date\` is IST-aligned

**CTR and ratio measures**
- \`ctr\`, \`roas\`, \`cpc\`, \`cpm\` are pre-calculated weighted averages -- use them directly, do not recompute from raw sums
- \`ctr\` is stored as a decimal (0.177 = 17.7%) -- display as percentage

**P&L by month/week**
- Use \`getPnlTrend\` -- do not use \`runQuery\` with guessed \`daily_pnl\` fields

**Attribution vs actual spend**
- \`dw_meta_ads_attribution.ad_spend\` is attribution-window spend, not the true billing total
- For company-level total ad spend always use \`daily_pnl.total_ad_spend\`

**Top campaigns by CTR**
- Always add \`filters: [{ "member": "ad_performance.impressions", "operator": "gt", "values": ["0"] }]\` -- campaigns with 0 impressions have null CTR and sort to the top in descending order

## Product revenue / COGS by product -- nested aggregate limitation

Querying \`shopify_order_line_items.net_line_revenue_ex_gst\`, \`total_cogs\`, \`gross_profit_ex_gst\`, or \`avg_discounted_unit_price\` with \`product_title\` or \`sku\` as a dimension always fails: "aggregate function calls cannot be nested". Same error on \`product_performance\` view grouped by any product dimension.

Root cause: \`product_title\` joins \`shopify_product_variants\` while COGS joins \`product_variant_cost_history\` -- two simultaneous joins Cube cannot nest.

**Safe measures with product dimensions (no error):** \`total_quantity\`, \`line_item_count\`, \`unique_products\`

**For top products by units sold, use runQuery:**
\`\`\`json
{
  "dimensions": ["shopify_order_line_items.product_title"],
  "measures": ["shopify_order_line_items.total_quantity"],
  "timeDimensions": [{ "dimension": "shopify_order_line_items.created_at_ist", "dateRange": ["<start>", "<end>"] }],
  "order": { "shopify_order_line_items.total_quantity": "desc" },
  "limit": 15
}
\`\`\`

**For revenue or COGS by product:** tell the user this requires a Cube model change (pre-aggregation or a \`product_code\` dimension extracted from campaign names). Do not attempt workarounds -- raw rows do not contain cost data at query time.

## Adset / campaign comparison (Meta)

Use \`marketing_performance\` with the entity as a dimension:
\`\`\`json
{
  "measures": ["marketing_performance.ad_spend", "marketing_performance.roas", "marketing_performance.ctr", "marketing_performance.cpc", "marketing_performance.impressions", "marketing_performance.purchases"],
  "dimensions": ["marketing_performance.campaign_name"],
  "timeDimensions": [{ "dimension": "marketing_performance.date_start", "dateRange": ["<start>", "<end>"] }],
  "order": { "marketing_performance.ad_spend": "desc" },
  "limit": 20
}
\`\`\`

- Swap \`campaign_name\` for \`adset_name\` for adset-level view.
- Do NOT use \`daily_pnl\` for delivery/ROAS metrics -- those are aggregate P&L only.`
}
