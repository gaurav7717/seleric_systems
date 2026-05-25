import { z } from "zod"
import type { SchemaCache } from "@/lib/cube-client"
import { getCubeDetails } from "@/lib/cube-client"
import { dateRangeSchema } from "../schemas"
import { fail, okRows, runTool } from "../tool-result"
import { fetchChannelBreakdown, fetchDailyPnl, fetchPnlTrend, PNL_MEASURES } from "../pnl"

function derivePnlMeasures(schema: SchemaCache): readonly string[] {
  const cube = getCubeDetails(schema, "daily_pnl")
  if (cube?.measures.length) return cube.measures.map((m) => m.name)
  return PNL_MEASURES
}

export function getPnlInstructions(schema: SchemaCache): string {
  const measures = derivePnlMeasures(schema)
  const spendField = measures.find((m) => m.includes("ad_spend")) ?? "daily_pnl.total_ad_spend"
  const ordersField = measures.find((m) => m.includes("orders")) ?? "daily_pnl.total_orders"

  return `## P&L tools
- **getDailyPnl** — P&L for any date range as one aggregate row OR day-by-day trend. Set groupByDay=false for period totals; groupByDay=true for daily chart.
- **getPnlTrend** — P&L broken down by week or month (preferred for "per month", "monthly trend", "by week"). Adds derived CAC per period.
- **getChannelBreakdown** — Meta vs Google vs Organic split for any date range.

## Derived metrics (not Cube measures — compute after fetch)
- **CAC** = total_ad_spend ÷ total_orders for the period (field keys: ${spendField} and ${ordersField})
- **LTV** is NOT in the semantic layer. Say so clearly. Offer AOV as a proxy only if the user accepts it.

## When to use which P&L tool
- Period total or daily chart → getDailyPnl (groupByDay=false or true)
- "per month" / "by week" / monthly trend → getPnlTrend
- Channel split (Meta vs Google vs Organic) → getChannelBreakdown
- For CAC/LTV: use getPnlTrend (monthly) plus getDailyPnl with groupByDay=false for period totals`
}

export function createPnlTools(schema: SchemaCache) {
  const measures = derivePnlMeasures(schema)

  return {
    getDailyPnl: {
      description:
        "Get P&L for any date range: revenue, ad spend, gross profit, net profit, orders. Supports single day or multi-day trend. Pass metrics to limit to specific measures.",
      inputSchema: dateRangeSchema.extend({
        groupByDay: z
          .boolean()
          .optional()
          .default(false)
          .describe("false = one aggregate row for the whole range (default). true = one row per day for charts."),
        metrics: z
          .array(z.string())
          .optional()
          .describe(
            "Optional subset of metrics to return — e.g. ['revenue','ad_spend'] for a simple comparison. Omit for the full P&L suite (triggers a comprehensive dashboard)."
          ),
      }),
      execute: ({
        startDate,
        endDate,
        groupByDay,
        metrics,
      }: {
        startDate: string
        endDate?: string
        groupByDay?: boolean
        metrics?: string[]
      }) =>
        runTool(async () => {
          const end = endDate ?? startDate
          const rows = await fetchDailyPnl(startDate, end, groupByDay ?? false, metrics)
          return okRows(rows, { type: rows.length > 2 ? "trend" : "kpi" })
        }),
    },

    getPnlTrend: {
      description:
        "P&L time series by week or month. Use for 'per month', 'monthly breakdown', 'by week'. Includes derived CAC per period.",
      inputSchema: z.object({
        startDate: z.string().describe("Start date YYYY-MM-DD"),
        endDate: z.string().describe("End date YYYY-MM-DD"),
        granularity: z
          .enum(["day", "week", "month"])
          .default("month")
          .describe("Time bucket: month for monthly P&L, week, or day"),
      }),
      execute: ({
        startDate,
        endDate,
        granularity,
      }: {
        startDate: string
        endDate: string
        granularity?: "day" | "week" | "month"
      }) =>
        runTool(async () => {
          const g = granularity ?? "month"
          const rows = await fetchPnlTrend(startDate, endDate, g, measures)
          if (!rows.length) {
            return fail(
              `No P&L rows for ${startDate}–${endDate} (${g}). Check dates or use getDailyPnl with groupByDay=false for a single total.`
            )
          }
          return okRows(rows, {
            type: "trend",
            label: `P&L by ${g}`,
            layout: rows.length >= 6 ? "pnl_dashboard" : undefined,
          })
        }),
    },

    getChannelBreakdown: {
      description:
        "Get P&L split by channel: Meta, Google, Organic — revenue, ad spend, net profit, orders for each.",
      inputSchema: dateRangeSchema,
      execute: ({ startDate, endDate }: { startDate: string; endDate?: string }) =>
        runTool(async () => {
          const rows = await fetchChannelBreakdown(startDate, endDate ?? startDate)
          return okRows(rows, { type: "channel" })
        }),
    },
  }
}
