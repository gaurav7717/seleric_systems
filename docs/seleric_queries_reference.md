# Seleric Query Reference — All 29 Charts

> All queries use `cube_query` format. Timezone: IST (Asia/Kolkata). Returns: `RETURNED` + `IN_PROGRESS` only.

---

## ⚡ Net Profit — Canonical Formula

```
daily_pnl.net_profit  =  total_sales_ex_gst  −  total_cogs  −  total_ad_spend
```

| Component | Definition |
|---|---|
| `total_sales_ex_gst` | Net line sales ÷ 1.18, excludes RETURNED + IN_PROGRESS orders |
| `total_cogs` | Date-effective unit cost × qty (from `product_variant_cost_history`) |
| `total_ad_spend` | Meta `ads_insights_hourly` + Google — **NOT** attribution tables |

> **Never** compute net_profit by stitching `shopify_orders.gross_revenue − dw_meta_ads_attribution.ad_spend` — this inflates profit by tens of thousands. Always use `daily_pnl.net_profit` or the `cube_daily_pnl` tool.

---

## 📊 Main Dashboard — Executive Overview

---

### #01 — P&L KPI Strip
**Chart type:** Metric cards · Today vs yesterday  
**Cube:** `daily_pnl`  
**Formula:** `net_profit = total_sales_ex_gst − total_cogs − total_ad_spend` · `gross_margin_pct = gross_profit / total_sales_ex_gst`  
> Use `cube_pnl_today_yesterday` tool for today/yesterday comparison — it handles IST timezone automatically.

```json
{
  "measures": [
    "daily_pnl.net_profit",
    "daily_pnl.gross_profit",
    "daily_pnl.total_sales_ex_gst",
    "daily_pnl.total_cogs",
    "daily_pnl.total_ad_spend",
    "daily_pnl.total_orders",
    "daily_pnl.gross_margin_pct"
  ],
  "timeDimensions": [{
    "dimension": "daily_pnl.report_date",
    "dateRange": "today"
  }]
}
```

---

### #02 — Net Profit over Time
**Chart type:** Line chart · 30d / 90d daily trend  
**Cube:** `daily_pnl`  
**Formula:** `net_profit = total_sales_ex_gst − total_cogs − total_ad_spend` grouped daily by `report_date` (IST)

```json
{
  "measures": [
    "daily_pnl.net_profit",
    "daily_pnl.gross_profit"
  ],
  "timeDimensions": [{
    "dimension": "daily_pnl.report_date",
    "granularity": "day",
    "dateRange": "last 30 days"
  }],
  "order": { "daily_pnl.report_date": "asc" }
}
```

---

### #03 — Revenue vs Ad Spend vs COGS
**Chart type:** Grouped bar chart · Daily  
**Cube:** `daily_pnl`  
**Formula:** `gross_profit = total_sales_ex_gst − total_cogs` · `net_profit = gross_profit − total_ad_spend`

```json
{
  "measures": [
    "daily_pnl.total_sales_ex_gst",
    "daily_pnl.total_cogs",
    "daily_pnl.total_ad_spend",
    "daily_pnl.net_profit"
  ],
  "timeDimensions": [{
    "dimension": "daily_pnl.report_date",
    "granularity": "day",
    "dateRange": "last 30 days"
  }],
  "order": { "daily_pnl.report_date": "asc" }
}
```

---

### #04 — Revenue by Channel
**Chart type:** Donut chart · Meta / Google / Organic  
**Cube:** `channel_pnl`  
**Formula:** `attributed_revenue_ex_gst = Meta + Google + Organic revenue ÷ 1.18`

```json
{
  "measures": [
    "channel_pnl.meta_attributed_revenue_ex_gst",
    "channel_pnl.google_attributed_revenue_ex_gst",
    "channel_pnl.organic_attributed_revenue_ex_gst",
    "channel_pnl.meta_attributed_orders",
    "channel_pnl.google_attributed_orders",
    "channel_pnl.organic_attributed_orders"
  ],
  "timeDimensions": [{
    "dimension": "channel_pnl.date_start",
    "dateRange": "last 30 days"
  }]
}
```

---

### #05 — Net Profit by Channel (Daily)
**Chart type:** Stacked bar · Meta / Google / Organic  
**Cube:** `channel_pnl`  
**Formula:** `meta_net_profit = Meta gross revenue − Meta COGS − Meta ad_spend` · same for Google / Organic

```json
{
  "measures": [
    "channel_pnl.meta_net_profit",
    "channel_pnl.google_net_profit",
    "channel_pnl.organic_net_profit"
  ],
  "timeDimensions": [{
    "dimension": "channel_pnl.date_start",
    "granularity": "day",
    "dateRange": "last 30 days"
  }],
  "order": { "channel_pnl.date_start": "asc" }
}
```

---

### #06 — Orders & AOV Trend
**Chart type:** Dual-axis line · Orders (left) + AOV (right)  
**Cube:** `shopify_orders`  
**Formula:** `aov = gross_revenue / orders` · `net_orders = orders − cancelled_orders`

```json
{
  "measures": [
    "shopify_orders.net_orders",
    "shopify_orders.aov",
    "shopify_orders.gross_revenue"
  ],
  "timeDimensions": [{
    "dimension": "shopify_orders.created_at_ist",
    "granularity": "day",
    "dateRange": "last 30 days"
  }],
  "order": { "shopify_orders.created_at_ist": "asc" }
}
```

> Always use `created_at_ist` (IST), never `created_at` (UTC).

---

### #07 — ROAS by Channel (Daily)
**Chart type:** Bar chart · Meta vs Google  
**Cube:** `channel_pnl`  
**Formula:** `meta_roas = meta_attributed_revenue / meta_ad_spend` · `google_roas = google_attributed_revenue / google_ad_spend`

```json
{
  "measures": [
    "channel_pnl.meta_roas",
    "channel_pnl.google_roas",
    "channel_pnl.meta_ad_spend",
    "channel_pnl.google_ad_spend"
  ],
  "timeDimensions": [{
    "dimension": "channel_pnl.date_start",
    "granularity": "day",
    "dateRange": "last 30 days"
  }],
  "order": { "channel_pnl.date_start": "asc" }
}
```

---

### #08 — Gross Margin % Trend
**Chart type:** Area chart · Daily  
**Cube:** `daily_pnl`  
**Formula:** `gross_margin_pct = gross_profit / total_sales_ex_gst × 100`

```json
{
  "measures": [
    "daily_pnl.gross_margin_pct",
    "daily_pnl.gross_profit",
    "daily_pnl.total_sales_ex_gst"
  ],
  "timeDimensions": [{
    "dimension": "daily_pnl.report_date",
    "granularity": "day",
    "dateRange": "last 30 days"
  }],
  "order": { "daily_pnl.report_date": "asc" }
}
```

---

### #09 — Return Rate Trend
**Chart type:** Line chart · Daily  
**Cube:** `shopify_orders`  
**Formula:** `return_rate = returned_orders / net_orders` · `returned_orders = return_status IN ('RETURNED', 'IN_PROGRESS') ONLY`

> **Do NOT** use `IS NOT NULL` on `return_status` — Shopify sets it to `NO_RETURN` on ~98% of normal orders, which inflates returns to nearly 100%.

```json
{
  "measures": [
    "shopify_orders.return_rate",
    "shopify_orders.returned_orders",
    "shopify_orders.net_orders"
  ],
  "timeDimensions": [{
    "dimension": "shopify_orders.created_at_ist",
    "granularity": "day",
    "dateRange": "last 30 days"
  }],
  "order": { "shopify_orders.created_at_ist": "asc" }
}
```

---

### #10 — P&L Waterfall (Revenue → Profit)
**Chart type:** Waterfall / stepped bar · Period total  
**Cube:** `daily_pnl`  
**Formula:** `total_sales_ex_gst → −total_cogs = gross_profit → −total_ad_spend = net_profit`

```json
{
  "measures": [
    "daily_pnl.total_sales_ex_gst",
    "daily_pnl.total_cogs",
    "daily_pnl.gross_profit",
    "daily_pnl.total_ad_spend",
    "daily_pnl.net_profit"
  ],
  "timeDimensions": [{
    "dimension": "daily_pnl.report_date",
    "dateRange": "last 30 days"
  }]
}
```

> No `granularity` = period aggregate (single waterfall for the whole range).

---

## 📣 Meta Ads — Ad Performance & Attribution

---

### #11 — Ad Spend + ROAS Daily
**Chart type:** Dual-axis line · Spend (₹) left, ROAS right  
**Cube:** `marketing_performance`  
**Formula:** `roas = purchase_value / ad_spend` · `purchase_value = pixel purchases + onsite web purchases combined`

```json
{
  "measures": [
    "marketing_performance.ad_spend",
    "marketing_performance.roas",
    "marketing_performance.purchase_value",
    "marketing_performance.purchases"
  ],
  "timeDimensions": [{
    "dimension": "marketing_performance.date_start",
    "granularity": "day",
    "dateRange": "last 30 days"
  }],
  "order": { "marketing_performance.date_start": "asc" }
}
```

---

### #12 — Impressions vs Clicks vs CTR
**Chart type:** Grouped bar (impressions + clicks) + line (CTR)  
**Cube:** `marketing_performance`  
**Formula:** `ctr = clicks / impressions` (weighted avg) · `cpc = ad_spend / clicks`

```json
{
  "measures": [
    "marketing_performance.impressions",
    "marketing_performance.clicks",
    "marketing_performance.ctr",
    "marketing_performance.cpc"
  ],
  "timeDimensions": [{
    "dimension": "marketing_performance.date_start",
    "granularity": "day",
    "dateRange": "last 30 days"
  }],
  "order": { "marketing_performance.date_start": "asc" }
}
```

> `ctr` and `cpc` are pre-calculated weighted averages — use directly, do not recompute from raw sums.

---

### #13 — CPC · CPM · CPA — Metric Cards
**Chart type:** KPI strip · Period vs prior period  
**Cube:** `marketing_performance`  
**Formula:** `cpc = ad_spend / clicks` · `cpm = (ad_spend / impressions) × 1000` · `cpa = ad_spend / purchases` (compute in app)

```json
{
  "measures": [
    "marketing_performance.cpc",
    "marketing_performance.cpm",
    "marketing_performance.ad_spend",
    "marketing_performance.purchases",
    "marketing_performance.conversion_rate"
  ],
  "timeDimensions": [{
    "dimension": "marketing_performance.date_start",
    "dateRange": "last 30 days"
  }]
}
```

> CPA is not a pre-built measure — derive it in the app as `ad_spend / purchases`.

---

### #14 — Top Campaigns by ROAS
**Chart type:** Horizontal ranked bar · Top 10  
**Cube:** `marketing_performance`  
**Formula:** `roas = purchase_value / ad_spend` (pixel-based, per campaign)

```json
{
  "measures": [
    "marketing_performance.roas",
    "marketing_performance.ad_spend",
    "marketing_performance.purchase_value",
    "marketing_performance.purchases",
    "marketing_performance.cpc"
  ],
  "dimensions": ["marketing_performance.campaign_name"],
  "timeDimensions": [{
    "dimension": "marketing_performance.date_start",
    "dateRange": "last 30 days"
  }],
  "order": { "marketing_performance.roas": "desc" },
  "limit": 10
}
```

---

### #15 — Adset Performance Table
**Chart type:** Sortable data table · Campaign × Adset  
**Cube:** `marketing_performance`

```json
{
  "measures": [
    "marketing_performance.ad_spend",
    "marketing_performance.roas",
    "marketing_performance.ctr",
    "marketing_performance.cpc",
    "marketing_performance.cpm",
    "marketing_performance.purchases",
    "marketing_performance.purchase_value",
    "marketing_performance.impressions",
    "marketing_performance.clicks",
    "marketing_performance.conversion_rate"
  ],
  "dimensions": [
    "marketing_performance.campaign_name",
    "marketing_performance.adset_name"
  ],
  "timeDimensions": [{
    "dimension": "marketing_performance.date_start",
    "dateRange": "last 30 days"
  }],
  "order": { "marketing_performance.ad_spend": "desc" },
  "limit": 50
}
```

---

### #16 — Purchase Funnel
**Chart type:** Funnel chart · Period aggregate  
**Cube:** `marketing_performance`  
**Formula:** `impressions → link_clicks → landing_page_views → add_to_carts → initiated_checkouts → purchases` · drop-off % computed in app

```json
{
  "measures": [
    "marketing_performance.impressions",
    "marketing_performance.link_clicks",
    "marketing_performance.landing_page_views",
    "marketing_performance.add_to_carts",
    "marketing_performance.initiated_checkouts",
    "marketing_performance.purchases"
  ],
  "timeDimensions": [{
    "dimension": "marketing_performance.date_start",
    "dateRange": "last 30 days"
  }]
}
```

> Use `link_clicks` (not `clicks`) as the top-of-funnel step after impressions — it's the more intent-driven signal.

---

### #17 — Spend & ROAS by Hour of Day
**Chart type:** Heatmap / bar · 24 hourly windows  
**Cube:** `ad_performance`

> Use `ad_performance` (not `marketing_performance`) — it is the only cube that exposes the `hourly_window` dimension.

```json
{
  "measures": [
    "ad_performance.ad_spend",
    "ad_performance.roas",
    "ad_performance.purchases",
    "ad_performance.impressions"
  ],
  "dimensions": ["ad_performance.hourly_window"],
  "timeDimensions": [{
    "dimension": "ad_performance.date_start",
    "dateRange": "last 30 days"
  }],
  "order": { "ad_performance.hourly_window": "asc" }
}
```

---

### #18 — Attribution vs Actual Spend
**Chart type:** Side-by-side bar · Campaign level  
**Cube:** `dw_meta_ads_attribution`  
**Formula:** `attributed_gross_profit = attributed_revenue − attributed_cogs` · `roas = attributed_revenue / ad_spend`

> `dw_meta_ads_attribution.ad_spend` is attribution-table spend — for company-level total ad spend always use `daily_pnl.total_ad_spend`.

```json
{
  "measures": [
    "dw_meta_ads_attribution.attributed_revenue",
    "dw_meta_ads_attribution.attributed_orders",
    "dw_meta_ads_attribution.attributed_cogs",
    "dw_meta_ads_attribution.attributed_gross_profit",
    "dw_meta_ads_attribution.roas"
  ],
  "dimensions": ["dw_meta_ads_attribution.campaign_name"],
  "timeDimensions": [{
    "dimension": "dw_meta_ads_attribution.date_start",
    "dateRange": "last 30 days"
  }],
  "order": { "dw_meta_ads_attribution.attributed_revenue": "desc" },
  "limit": 15
}
```

---

### #19 — Video & Engagement KPIs
**Chart type:** Metric cards + trend lines  
**Cube:** `ad_performance`

```json
{
  "measures": [
    "ad_performance.video_views",
    "ad_performance.post_engagements",
    "ad_performance.link_clicks",
    "ad_performance.landing_page_views",
    "ad_performance.add_to_carts"
  ],
  "timeDimensions": [{
    "dimension": "ad_performance.date_start",
    "granularity": "day",
    "dateRange": "last 30 days"
  }],
  "order": { "ad_performance.date_start": "asc" }
}
```

---

## 🛍 Shopify — Store & Product Analytics

---

### #20 — Revenue & Orders Daily
**Chart type:** Line + bar combo · Daily  
**Cube:** `shopify_orders`  
**Formula:** `aov = gross_revenue / orders` · `net_sales_ex_gst = line-item net sales ÷ 1.18, excludes returns`

```json
{
  "measures": [
    "shopify_orders.gross_revenue",
    "shopify_orders.net_sales_ex_gst",
    "shopify_orders.net_orders",
    "shopify_orders.aov"
  ],
  "timeDimensions": [{
    "dimension": "shopify_orders.created_at_ist",
    "granularity": "day",
    "dateRange": "last 30 days"
  }],
  "order": { "shopify_orders.created_at_ist": "asc" }
}
```

---

### #21 — Top Products by Revenue
**Chart type:** Horizontal ranked bar · Top 15  
**Cube:** `product_performance`  
**Formula:** `gross_profit_ex_gst = net_line_revenue_ex_gst − total_cogs` (before ad spend)

```json
{
  "measures": [
    "product_performance.gross_line_revenue_ex_gst",
    "product_performance.net_line_revenue_ex_gst",
    "product_performance.total_quantity",
    "product_performance.gross_profit_ex_gst",
    "product_performance.total_cogs"
  ],
  "dimensions": ["product_performance.product_title"],
  "timeDimensions": [{
    "dimension": "product_performance.created_at_ist",
    "dateRange": "last 30 days"
  }],
  "order": { "product_performance.net_line_revenue_ex_gst": "desc" },
  "limit": 15
}
```

> Sort by `net_line_revenue_ex_gst` (excludes returns), not `gross_line_revenue_ex_gst` (includes returns).

---

### #22 — Return & Cancel Analysis by Product
**Chart type:** Stacked bar · returned vs cancelled vs fulfilled  
**Cube:** `product_performance`  
**Formula:** `returned_units = qty where return_status IN ('RETURNED', 'IN_PROGRESS') only`

> `returned_units` is pre-filtered to RETURNED + IN_PROGRESS. Do NOT add an extra `return_status` filter — it will break the query.

```json
{
  "measures": [
    "product_performance.returned_units",
    "product_performance.cancelled_units",
    "product_performance.total_quantity",
    "product_performance.total_line_discounts"
  ],
  "dimensions": ["product_performance.product_title"],
  "timeDimensions": [{
    "dimension": "product_performance.created_at_ist",
    "dateRange": "last 30 days"
  }],
  "order": { "product_performance.returned_units": "desc" },
  "limit": 20
}
```

---

### #23 — Revenue by Geography
**Chart type:** Choropleth / ranked list · Country & Province  
**Cube:** `shopify_orders`

```json
{
  "measures": [
    "shopify_orders.gross_revenue",
    "shopify_orders.net_orders",
    "shopify_orders.aov"
  ],
  "dimensions": [
    "shopify_orders.ship_country",
    "shopify_orders.ship_province"
  ],
  "timeDimensions": [{
    "dimension": "shopify_orders.created_at_ist",
    "dateRange": "last 30 days"
  }],
  "order": { "shopify_orders.gross_revenue": "desc" },
  "limit": 50
}
```

> Remove `ship_province` from dimensions for country-level only view.

---

### #24 — UTM Source Breakdown
**Chart type:** Donut + ranked table  
**Cube:** `shopify_orders`

```json
{
  "measures": [
    "shopify_orders.gross_revenue",
    "shopify_orders.net_orders",
    "shopify_orders.aov"
  ],
  "dimensions": [
    "shopify_orders.utm_source",
    "shopify_orders.utm_medium",
    "shopify_orders.utm_campaign"
  ],
  "timeDimensions": [{
    "dimension": "shopify_orders.created_at_ist",
    "dateRange": "last 30 days"
  }],
  "order": { "shopify_orders.gross_revenue": "desc" },
  "limit": 30
}
```

> Remove `utm_medium` and `utm_campaign` for a cleaner source-only donut.

---

### #25 — Discount Impact
**Chart type:** Bar chart · Daily discounts vs net revenue  
**Cube:** `shopify_order_line_items`  
**Formula:** `total_line_discounts = gross_line_revenue − net_line_revenue` · `gross_profit_ex_gst = net_line_revenue_ex_gst − total_cogs`

```json
{
  "measures": [
    "shopify_order_line_items.total_line_discounts",
    "shopify_order_line_items.net_line_revenue_ex_gst",
    "shopify_order_line_items.gross_profit_ex_gst",
    "shopify_order_line_items.total_cogs",
    "shopify_order_line_items.avg_unit_price",
    "shopify_order_line_items.avg_discounted_unit_price"
  ],
  "timeDimensions": [{
    "dimension": "shopify_order_line_items.created_at_ist",
    "granularity": "day",
    "dateRange": "last 30 days"
  }],
  "order": { "shopify_order_line_items.created_at_ist": "asc" }
}
```

---

### #26 — Units per Order & AOV
**Chart type:** Line chart · Basket size over time  
**Cube:** `shopify_order_line_items`

```json
{
  "measures": [
    "shopify_order_line_items.units_per_order",
    "shopify_order_line_items.avg_unit_price",
    "shopify_order_line_items.avg_discounted_unit_price",
    "shopify_order_line_items.unique_products"
  ],
  "timeDimensions": [{
    "dimension": "shopify_order_line_items.created_at_ist",
    "granularity": "day",
    "dateRange": "last 30 days"
  }],
  "order": { "shopify_order_line_items.created_at_ist": "asc" }
}
```

---

### #27 — Fulfillment Status Mix
**Chart type:** Donut chart · Period total  
**Cube:** `shopify_orders`

```json
{
  "measures": [
    "shopify_orders.orders",
    "shopify_orders.gross_revenue"
  ],
  "dimensions": ["shopify_orders.fulfillment_status"],
  "timeDimensions": [{
    "dimension": "shopify_orders.created_at_ist",
    "dateRange": "last 30 days"
  }],
  "order": { "shopify_orders.orders": "desc" }
}
```

---

### #28 — Gross Margin by SKU
**Chart type:** Scatter / ranked bar · Top 20 SKUs  
**Cube:** `product_performance`  
**Formula:** `gross_profit_ex_gst = net_line_revenue_ex_gst − total_cogs` · `margin% = gross_profit_ex_gst / net_line_revenue_ex_gst` (compute in app)

```json
{
  "measures": [
    "product_performance.gross_profit_ex_gst",
    "product_performance.total_cogs",
    "product_performance.net_line_revenue_ex_gst",
    "product_performance.avg_unit_price",
    "product_performance.avg_discounted_unit_price",
    "product_performance.total_quantity"
  ],
  "dimensions": [
    "product_performance.sku",
    "product_performance.product_title"
  ],
  "timeDimensions": [{
    "dimension": "product_performance.created_at_ist",
    "dateRange": "last 30 days"
  }],
  "order": { "product_performance.gross_profit_ex_gst": "desc" },
  "limit": 20
}
```

---

### #29 — Shipping Revenue Contribution
**Chart type:** Stacked area chart · Daily  
**Cube:** `shopify_orders`  
**Formula:** `gross_revenue = product revenue + shipping_revenue` · `net_sales_ex_gst = gross_revenue − discounts − returns ÷ 1.18`

```json
{
  "measures": [
    "shopify_orders.gross_revenue",
    "shopify_orders.shipping_revenue",
    "shopify_orders.net_sales_ex_gst",
    "shopify_orders.orders_with_shipping"
  ],
  "timeDimensions": [{
    "dimension": "shopify_orders.created_at_ist",
    "granularity": "day",
    "dateRange": "last 30 days"
  }],
  "order": { "shopify_orders.created_at_ist": "asc" }
}
```

---

## 📋 Cube Quick Reference

| Cube | Primary Use | Key Rule |
|---|---|---|
| `daily_pnl` | All P&L totals — net profit, gross profit, COGS, ad spend | Canonical source for `net_profit`. Never recompute manually. |
| `channel_pnl` | Meta / Google / Organic channel breakdown | Use for channel cards; company total still from `daily_pnl`. |
| `marketing_performance` | Meta campaign/adset/ad delivery metrics | Correct spend source for ROAS, CPM, CPC, CTR. |
| `ad_performance` | Hourly breakdown, `hourly_window` dimension | Only cube exposing `hourly_window` — use for hour-of-day charts. |
| `dw_meta_ads_attribution` | Revenue/orders attributed to Meta per campaign | Do NOT use `ad_spend` from here for company totals. |
| `shopify_orders` | Order-level data, geography, UTM, AOV | Always use `created_at_ist`. `return_rate` pre-filtered correctly. |
| `shopify_order_line_items` | Line-item discounts, units per order, per-item COGS | `returned_units` = RETURNED + IN_PROGRESS only (pre-filtered). |
| `product_performance` | SKU-level revenue, margin, returns | `gross_profit_ex_gst = net_line_revenue_ex_gst − total_cogs`. |

---

*Generated from Seleric `cube_meta` · Timezone: IST (Asia/Kolkata) · Returns: `RETURNED` + `IN_PROGRESS` only*
