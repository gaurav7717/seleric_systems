import { z } from "zod"
import { callCubeTool } from "@/lib/cube-client"
import { runComputedAnalysis } from "../computed-query"
import { detectChartType, extractRows, rowDimValue } from "../cube-rows"
import { IST_TIMEZONE } from "../pnl"
import { computedSpecSchema, cubeQuerySchema } from "../schemas"
import type { ChatToolResult } from "../tool-result"
import { okRows, runTool } from "../tool-result"

export function getQueryInstructions(): string {
  return `## Query tools
- **runQuery** — Run any custom Cube query. Use exploreSchema first to confirm field names. Good for ad campaigns, products, orders, filters.
- **runComputedQuery** — Fetch raw rows from Cube then apply in-memory computation: pair_count, group_by, top_n, raw, **formula** (derive a ratio column). Use when runQuery fails with nested-aggregate errors or for cross-row analysis.
- **mergeQueryResults** — Fetch rows from two different cubes in parallel and inner-join them on a shared key column. Use for cross-cube questions where one cube has dimension context and another has the metrics.
- **clarify** — Ask the user a targeted question when the query is genuinely ambiguous. Use sparingly.
- **exploreSchema** — Get all measures and dimensions for a cube. Always call before runQuery/runComputedQuery/mergeQueryResults when you need exact field names.

## When to use each query tool
- Standard aggregation (sums, counts, trends, filters) → **runQuery**
- Cross-row logic, market basket, nested-aggregate error → **runComputedQuery**
- Data needed from two cubes (e.g. campaign spend + attributed revenue) → **mergeQueryResults**
- Derive a ratio from two columns already fetched → **runComputedQuery** with compute.type="formula"
- Query is ambiguous and wrong guess misleads → **clarify**

## runComputedQuery compute types
- **pair_count** — market basket / co-purchase analysis
- **group_by** — re-aggregate raw rows by one or more keys
- **top_n** — rank rows by a numeric column, return top N
- **raw** — return rows as-is for further analysis in text
- **formula** — derive a new column per row: outputColumn = (numerator / denominator) * scale
  - Example: compute ROAS per campaign after fetching spend + attributed_revenue in one runComputedQuery
  - scale=100 converts a decimal to a percentage

## Product pairing (market basket)
- Use **runComputedQuery** only (not runQuery).
- Cube: shopify_order_line_items. groupByDim: shopify_order_line_items.order_id. pairDim: shopify_order_line_items.title. Time: shopify_order_line_items.created_at_ist.

## mergeQueryResults join key selection
- The joinKey must appear as a column in BOTH result sets after Cube returns rows.
- Use fully-qualified names matching the dimension in the query (e.g. "marketing_performance.campaign_name") OR the short suffix if Cube strips the prefix in output.
- joinType "inner" (default): only rows that match in both sets. "left": all rows from queryA, nulls for unmatched B columns.

## Queries that unlock richer visuals
- Trends over time → getPnlTrend or getDailyPnl with groupByDay=true
- Channel mix → getChannelBreakdown
- Top-N / ranking → runComputedQuery with top_n or runQuery with limit
- Distribution (e.g. AOV spread) → runQuery returning many rows with one numeric measure
- Correlation (spend vs ROAS) → runQuery or mergeQueryResults with two numeric measures per row`
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
      "Fetch raw dimensional rows from Cube then apply in-memory computation: pair_count, group_by, top_n, raw, or formula (derive a ratio column per row).",
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
        const type =
          compute.type === "pair_count" || compute.type === "top_n" ? "ranked"
          : compute.type === "group_by" ? (result.length > 6 ? "table" : "kpi")
          : compute.type === "formula" ? (result.length > 6 ? "table" : "kpi")
          : result.length > 6 ? "table" : "kpi"
        return okRows(result, { type, label: label ?? "Computed Result" })
      }),
  },

  mergeQueryResults: {
    description:
      "Fetch rows from two Cube cubes in parallel then inner-join on a shared key column. Use when a question spans two cubes (e.g. marketing_performance spend + dw_meta_ads_attribution revenue matched by campaign_name).",
    inputSchema: z.object({
      queryA: cubeQuerySchema.describe("First cube query"),
      queryB: cubeQuerySchema.describe("Second cube query"),
      joinKey: z
        .string()
        .describe(
          "Column name present in both result sets to join on (string equality). Use the exact key as it appears in Cube output rows, e.g. 'marketing_performance.campaign_name' or just 'campaign_name' if Cube strips the prefix."
        ),
      joinType: z
        .enum(["inner", "left"])
        .optional()
        .default("inner")
        .describe("inner (default): only matched rows. left: all rows from queryA, nulls for unmatched B columns."),
      label: z.string().optional().describe("Short label shown in the UI"),
    }),
    execute: ({
      queryA,
      queryB,
      joinKey,
      joinType = "inner",
      label,
    }: {
      queryA: Record<string, unknown>
      queryB: Record<string, unknown>
      joinKey: string
      joinType?: "inner" | "left"
      label?: string
    }) =>
      runTool(async () => {
        const [rawA, rawB] = await Promise.all([
          callCubeTool("cube_query", { query: { limit: 500, ...queryA, timezone: IST_TIMEZONE } }),
          callCubeTool("cube_query", { query: { limit: 500, ...queryB, timezone: IST_TIMEZONE } }),
        ])
        const rowsA = extractRows(rawA)
        const rowsB = extractRows(rawB)

        // Build lookup from B keyed by joinKey value (try both full name and suffix)
        const mapB = new Map<string, Record<string, unknown>>()
        for (const row of rowsB) {
          const key = rowDimValue(row, joinKey) || String(row[joinKey] ?? "")
          if (key) mapB.set(key, row)
        }

        const merged: Record<string, unknown>[] = []
        for (const row of rowsA) {
          const key = rowDimValue(row, joinKey) || String(row[joinKey] ?? "")
          const bRow = mapB.get(key)
          if (!bRow && joinType === "inner") continue
          merged.push({ ...row, ...(bRow ?? {}) })
        }

        const allMeasures = [
          ...((queryA.measures as string[]) ?? []),
          ...((queryB.measures as string[]) ?? []),
        ]
        const fakeQuery = { ...queryA, measures: allMeasures }
        return okRows(merged, {
          type: detectChartType(fakeQuery as Record<string, unknown>, merged),
          label: label ?? "Merged Result",
        })
      }),
  },

  clarify: {
    description:
      "Ask the user a targeted clarifying question when the query is genuinely ambiguous and the wrong interpretation would give a misleading answer. Use sparingly — only when two equally valid interpretations exist. Do not use for minor assumptions you can safely make yourself.",
    inputSchema: z.object({
      question: z.string().describe("The clarifying question to ask the user"),
      options: z
        .array(z.string())
        .optional()
        .describe("Optional 2–4 short quick-reply options the user can tap"),
    }),
    execute: ({ question, options }: { question: string; options?: string[] }) =>
      runTool(async () => ({
        ok: true,
        type: "clarify",
        question,
        options,
      } as ChatToolResult)),
  },
}
