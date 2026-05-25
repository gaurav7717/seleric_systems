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
- Do NOT use \`daily_pnl\` for delivery/ROAS metrics -- those are aggregate P&L only.

## Cube relationships -- shared dimensions for cross-cube analysis

When a question spans two cubes, fetch each separately then synthesize in your response. The table below shows which dimension links them.

| Cube A | Cube B | Shared join dimension | How to align |
|---|---|---|---|
| \`daily_pnl\` | \`channel_pnl\` | \`report_date\` | Same date range → compare totals vs channel split |
| \`daily_pnl\` | \`shopify_orders\` | date (IST) | \`daily_pnl.report_date\` ≈ \`shopify_orders.created_at_ist\` date bucket |
| \`marketing_performance\` | \`dw_meta_ads_attribution\` | \`campaign_name\` + date | Match by campaign_name for spend vs attributed revenue comparison |
| \`marketing_performance\` | \`ad_performance\` | \`campaign_name\` + date | marketing_performance = daily roll-up; ad_performance = hourly detail |
| \`shopify_orders\` | \`shopify_order_line_items\` | \`order_id\` | orders is order-level; line_items is SKU-level within same order |
| \`shopify_order_line_items\` | \`product_performance\` | \`product_title\` / \`sku\` | product_performance is a pre-aggregated view -- prefer it over raw line_items for SKU metrics |
| \`dw_meta_ads_attribution\` | \`shopify_orders\` | date + UTM | Attribution aligns by date; UTM campaign names link ad spend → order |

## Cross-cube query patterns

**Pattern 1 -- Period comparison across two cubes (same date range)**
Run both queries in the same step (parallel tool calls), then compare totals in your analysis.
Example: "How does our Meta ROAS compare to overall net margin this month?"
→ Step 1: \`getDailyPnl\` (net profit, ad spend) + \`runQuery\` on \`marketing_performance\` (ROAS) in parallel
→ Step 2: Compare in text: ROAS of X while net margin was Y%

**Pattern 2 -- Campaign-level: spend vs attributed revenue**
Example: "Which campaigns generated the most revenue vs what they cost?"
→ Step 1: \`runQuery\` on \`marketing_performance\` (ad_spend by campaign_name)
→ Step 2: \`runQuery\` on \`dw_meta_ads_attribution\` (attributed_revenue, attributed_orders by campaign_name)
→ Step 3: Match rows by campaign_name in your analysis; compute ROAS = attributed_revenue / ad_spend per campaign

**Pattern 3 -- Product + orders (SKU drill-down)**
Example: "Which products are selling the most and what is their return rate?"
→ Use \`product_performance\` in a single query -- it has both units sold and return data pre-joined.
→ Only fall back to \`shopify_order_line_items\` if product_performance lacks the specific measure.

**Pattern 4 -- Hourly pattern for a specific campaign**
Example: "When does campaign X get the best CTR during the day?"
→ \`runQuery\` on \`ad_performance\` with dimension \`hourly_window\` + filter on campaign_name

## When to synthesize in text vs when data is not joinable

- **Two cubes, same date range, aggregate totals** → fetch both in parallel, synthesize in text. No extra step needed.
- **Two cubes, row-level join needed** (e.g., ROAS per campaign matched across two cubes) → fetch both, align by the shared key column in your text analysis, flag any rows that do not match.
- **Data genuinely not joinable** (e.g., Shopify product title vs Meta creative name) → fetch each separately, answer what you can, state the limitation clearly.

## Adaptive recovery -- when queries fail or return no data

- **0 rows returned**: Try widening the date range (double it). If still 0, call \`exploreSchema\` on that cube to verify the time dimension name, then retry once.
- **"aggregate function calls cannot be nested" error**: Switch to \`runComputedQuery\` with \`type: "raw"\` or \`type: "top_n"\` -- Cube cannot handle the nested join; in-memory computation can.
- **Field name error / unknown member**: Call \`exploreSchema\` on the cube, get the exact field name, retry once. Never guess a second time.
- **Never answer "no data available" after a single failed attempt** -- always try at least one recovery path before concluding data is missing.`
}
