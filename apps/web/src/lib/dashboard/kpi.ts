import "server-only"

import { daysAgoIST, todayIST } from "@/lib/chat/dates"
import { PNL_KPI_MEASURES } from "./pnl-kpi-constants"
import { runCubeQuery, runCubeToolRows } from "./cube-query"

export async function fetchKpiTodayYesterday(): Promise<Record<string, unknown>[]> {
  let rows = await runCubeToolRows("cube_pnl_today_yesterday", {})

  if (rows.length >= 1) {
    return enrichKpiRows(rows)
  }

  const yesterday = daysAgoIST(1)
  const today = todayIST()
  rows = await runCubeQuery({
    measures: [...PNL_KPI_MEASURES],
    timeDimensions: [
      {
        dimension: "daily_pnl.report_date",
        granularity: "day",
        dateRange: [yesterday, today],
      },
    ],
    order: { "daily_pnl.report_date": "asc" },
  })

  return enrichKpiRows(rows)
}

function enrichKpiRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((row) => {
    if (row["daily_pnl.gross_margin_pct"] != null) return row
    const sales = Number(row["daily_pnl.total_sales_ex_gst"] ?? 0)
    const gross = Number(row["daily_pnl.gross_profit"] ?? 0)
    const pct = sales > 0 ? (gross / sales) * 100 : null
    return { ...row, "daily_pnl.gross_margin_pct": pct }
  })
}
