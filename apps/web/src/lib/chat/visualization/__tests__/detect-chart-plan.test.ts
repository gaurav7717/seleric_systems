import { describe, expect, it } from "vitest"
import { detectChartPlan } from "../detect-chart-plan"

const monthlyPnl = Array.from({ length: 8 }, (_, i) => ({
  "daily_pnl.report_date": `2025-${String(i + 4).padStart(2, "0")}-01T00:00:00.000`,
  "daily_pnl.total_sales_ex_gst": 1_000_000 * (i + 1),
  "daily_pnl.total_ad_spend": 800_000 * (i + 1),
  "daily_pnl.gross_profit": 400_000 * (i + 1),
  "daily_pnl.net_profit": -100_000 * (i % 2 === 0 ? 1 : -0.5),
  "daily_pnl.total_orders": 100 * (i + 1),
}))

describe("detectChartPlan", () => {
  it("detects pnl_dashboard for long P&L series", () => {
    const plans = detectChartPlan(monthlyPnl)
    expect(plans[0].kind).toBe("pnl_dashboard")
  })

  it("detects pie for few categories with one metric", () => {
    const rows = [
      { product: "Widget A", sales: 100 },
      { product: "Widget B", sales: 80 },
      { product: "Widget C", sales: 40 },
    ]
    const plans = detectChartPlan(rows)
    expect(plans[0].kind).toBe("pie")
  })

  it("detects histogram for many single-metric rows", () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({ order_value: 500 + i * 100 }))
    const plans = detectChartPlan(rows)
    expect(plans[0].kind).toBe("histogram")
  })
})
