import { z } from "zod"
import { callCubeTool } from "@/lib/cube-client"
import { runComputedAnalysis } from "../computed-query"
import { detectChartType, extractRows } from "../cube-rows"
import { IST_TIMEZONE } from "../pnl"
import { computedSpecSchema, cubeQuerySchema } from "../schemas"
import { okRows, runTool } from "../tool-result"

export function getQueryInstructions(): string {
  return `## Query tools
- **runQuery** — Run any custom Cube query. Use exploreSchema first to confirm field names. Good for ad campaigns, products, orders, filters.
- **runComputedQuery** — Fetch raw dimensional rows from Cube, then apply in-memory computation (pair_count, group_by, top_n). Use when runQuery fails with nested-aggregate errors, or for cross-row analysis like product pairing, cohort, custom pivot.
- **exploreSchema** — Get all measures and dimensions for a cube. Always call this before runQuery/runComputedQuery when you need field names.

## When to use runComputedQuery vs runQuery
- Use **runQuery** for standard aggregation Cube can handle: sums, counts, trends, filters.
- Use **runComputedQuery** when:
  - The analysis requires cross-row logic (e.g., "which products are bought together" = market basket)
  - Cube returns "aggregate function calls cannot be nested" error
  - You need to group-by + re-aggregate raw rows in a way Cube's query format can't express

## Product pairing (market basket)
- Use **runComputedQuery** only (not runQuery).
- Cube: shopify_order_line_items. groupByDim: shopify_order_line_items.order_id. pairDim: shopify_order_line_items.title. Time: shopify_order_line_items.created_at_ist.

## Queries that unlock richer visuals
- Trends over time → getPnlTrend or getDailyPnl with groupByDay=true
- Channel mix → getChannelBreakdown
- Top-N / ranking → runComputedQuery with top_n or runQuery with limit
- Distribution (e.g. AOV spread) → runQuery returning many rows with one numeric measure
- Correlation (spend vs ROAS) → runQuery with two numeric measures per row`
}

export const queryTools = {
  runQuery: {
    description:
      "Run any custom Cube query. Use exploreSchema first for exact field names. Good for: ad campaigns, products, SKUs, orders, hourly trends, custom filters.",
    inputSchema: z.object({
      query: cubeQuerySchema,
      label: z.string().optional().describe("Short label shown in the UI"),
    }),
    execute: ({ query, label }: { query: Record<string, unknown>; label?: string }) =>
      runTool(async () => {
        const q = { limit: 500, ...query, timezone: IST_TIMEZONE }
        const raw = await callCubeTool("cube_query", { query: q })
        const rows = extractRows(raw)
        return okRows(rows, {
          type: detectChartType(q, rows),
          label: label ?? "Query Result",
          query: q,
        })
      }),
  },

  runComputedQuery: {
    description:
      "Fetch raw dimensional rows from Cube then apply in-memory computation (pair_count, group_by, top_n, raw).",
    inputSchema: z.object({
      fetchQuery: cubeQuerySchema,
      compute: computedSpecSchema,
      label: z.string().optional().describe("Short label shown in the UI"),
    }),
    execute: ({
      fetchQuery,
      compute,
      label,
    }: {
      fetchQuery: Record<string, unknown>
      compute: z.infer<typeof computedSpecSchema>
      label?: string
    }) =>
      runTool(async () => {
        const result = await runComputedAnalysis(fetchQuery, compute)
        return okRows(result, {
          type: result.length > 6 ? "table" : "kpi",
          label: label ?? "Computed Result",
        })
      }),
  },
}
