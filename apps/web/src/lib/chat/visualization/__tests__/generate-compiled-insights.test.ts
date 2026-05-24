import { describe, expect, it } from "vitest"
import { generateCompiledInsights } from "../generate-compiled-insights"

describe("generateCompiledInsights", () => {
  it("includes channel split and LTV:CAC sections", () => {
    const merged = {
      seriesRows: [
        {
          "daily_pnl.report_date": "2026-01-01T00:00:00",
          "daily_pnl.total_sales_ex_gst": 1_000_000,
          "daily_pnl.total_ad_spend": 800_000,
          "daily_pnl.net_profit": -100_000,
          "daily_pnl.total_orders": 100,
        },
        {
          "daily_pnl.report_date": "2026-02-01T00:00:00",
          "daily_pnl.total_sales_ex_gst": 1_200_000,
          "daily_pnl.total_ad_spend": 700_000,
          "daily_pnl.net_profit": 50_000,
          "daily_pnl.total_orders": 120,
        },
      ],
      pnlSeriesRows: [],
      summaryRows: [],
      channelRows: [
        { channel: "Meta", revenue: 500_000, adSpend: 400_000, netProfit: -50_000 },
        { channel: "Organic", revenue: 300_000, adSpend: 0, netProfit: 100_000 },
      ],
      toolsUsed: ["getPnlTrend", "getChannelBreakdown"],
    }

    const sections = generateCompiledInsights(merged)
    const titles = sections.map((s) => s.title)
    expect(titles).toContain("Channel split")
    expect(titles.some((t) => t.includes("CAC") || t.includes("LTV"))).toBe(true)
  })
})
