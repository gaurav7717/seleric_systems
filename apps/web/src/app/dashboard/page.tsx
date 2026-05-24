import { AreaTrendChart } from "@/components/charts/AreaTrendChart"
import { ChartCard } from "@/components/charts/ChartCard"
import { DonutChart } from "@/components/charts/DonutChart"
import { GroupedBarChart } from "@/components/charts/GroupedBarChart"
import { PnlWaterfallChart } from "@/components/charts/PnlWaterfallChart"
import { StackedBarChart } from "@/components/charts/StackedBarChart"
import { KpiCards } from "@/components/chat/KpiCards"
import { TrendChart } from "@/components/chat/TrendChart"
import { daysAgoIST, todayIST } from "@/lib/chat/dates"
import {
  CHANNEL_NET_PROFIT_SERIES,
  channelRevenueSlices,
  pnlWaterfallSteps,
} from "@/lib/dashboard/page-helpers"
import { fetchMainDashboardData } from "@/lib/dashboard/queries/main"

export const revalidate = 60

export default async function DashboardPage() {
  const end = todayIST()
  const start = daysAgoIST(30)

  let data
  let error: string | null = null
  try {
    data = await fetchMainDashboardData(30)
  } catch (e) {
    error = String(e)
    data = null
  }

  const channelRow = data?.channelRevenue[0]
  const revenueSlices = channelRow ? channelRevenueSlices(channelRow) : []
  const waterfallRow = data?.pnlWaterfall[0] ?? {}

  return (
    <main className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-stone-900">Executive Overview</h1>
        <p className="text-sm text-slate-500 mt-1">
          Main dashboard · {start} → {end} · net_profit = sales ex GST − COGS − ad spend
        </p>
        {error && (
          <p className="mt-2 text-sm text-amber-400">
            Cube unavailable — charts may be empty. Check CUBE_MCP_URL / SELERIC_API_KEY.
          </p>
        )}
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard title="P&L KPI strip" subtitle="Today vs yesterday (IST)" cube="daily_pnl" className="xl:col-span-2">
          <KpiCards rows={data?.kpiTodayYesterday ?? []} type="today_vs_yesterday" />
        </ChartCard>

        <ChartCard title="Net profit over time" subtitle="daily_pnl.net_profit · 30d" cube="daily_pnl">
          <TrendChart rows={data?.netProfitTrend ?? []} />
        </ChartCard>

        <ChartCard title="Revenue vs ad spend vs COGS" subtitle="Daily grouped bar" cube="daily_pnl">
          <GroupedBarChart rows={data?.revenueVsSpend ?? []} />
        </ChartCard>

        <ChartCard title="Revenue by channel" subtitle="Attributed revenue ex GST" cube="channel_pnl">
          <DonutChart slices={revenueSlices} />
        </ChartCard>

        <ChartCard title="Net profit by channel" subtitle="Meta / Google / Organic daily" cube="channel_pnl">
          <StackedBarChart rows={data?.channelNetProfitTrend ?? []} series={[...CHANNEL_NET_PROFIT_SERIES]} />
        </ChartCard>

        <ChartCard title="Orders & AOV trend" subtitle="net_orders (left) + AOV (right)" cube="shopify_orders">
          <TrendChart rows={data?.ordersAovTrend ?? []} />
        </ChartCard>

        <ChartCard title="ROAS by channel" subtitle="Meta vs Google daily" cube="channel_pnl">
          <TrendChart rows={data?.roasByChannel ?? []} />
        </ChartCard>

        <ChartCard title="Gross margin % trend" subtitle="gross_profit / sales ex GST" cube="daily_pnl">
          <AreaTrendChart rows={data?.grossMarginTrend ?? []} />
        </ChartCard>

        <ChartCard title="Return rate trend" subtitle="RETURNED + IN_PROGRESS only" cube="shopify_orders">
          <TrendChart rows={data?.returnRateTrend ?? []} />
        </ChartCard>

        <ChartCard title="P&L waterfall" subtitle="Period total · sales → profit" cube="daily_pnl">
          <PnlWaterfallChart steps={pnlWaterfallSteps(waterfallRow)} />
        </ChartCard>
      </div>
    </main>
  )
}
