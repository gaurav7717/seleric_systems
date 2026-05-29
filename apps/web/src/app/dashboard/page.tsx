import { PnlKpiStrip } from "@/components/charts/PnlKpiStrip"
import { AreaTrendChart } from "@/components/charts/AreaTrendChart"
import { ChartCard } from "@/components/charts/ChartCard"
import { DonutChart } from "@/components/charts/DonutChart"
import { GroupedBarChart } from "@/components/charts/GroupedBarChart"
import { PnlWaterfallChart } from "@/components/charts/PnlWaterfallChart"
import { StackedBarChart } from "@/components/charts/StackedBarChart"
import { TrendChart } from "@/components/chat/TrendChart"
import { DateRangeControls } from "@/components/dashboard/DateRangeControls"
import { AgentActivityPanel } from "@/components/dashboard/AgentActivityPanel"
import {
  CHANNEL_NET_PROFIT_SERIES,
  channelRevenueSlices,
  pnlWaterfallSteps,
} from "@/lib/dashboard/page-helpers"
import { fetchMainDashboardData } from "@/lib/dashboard/queries/main"
import {
  dateRangeLabel,
  parseDashboardDateRange,
  type DashboardSearchParams,
} from "@/lib/dashboard/date-ranges"

export const revalidate = 60

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: DashboardSearchParams
}) {
  const range = parseDashboardDateRange(searchParams)
  const rangeLabel = dateRangeLabel(range)

  let data
  let error: string | null = null
  try {
    data = await fetchMainDashboardData(range)
  } catch (e) {
    error = String(e)
    data = null
  }

  const channelRow = data?.channelRevenue[0]
  const revenueSlices = channelRow ? channelRevenueSlices(channelRow) : []
  const waterfallRow = data?.pnlWaterfall[0] ?? {}

  return (
    <main className="p-6 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900 dark:text-night-50">Executive Overview</h1>
          <p className="text-sm text-stone-500 dark:text-night-500 mt-1">
            Main dashboard · {rangeLabel} · gross_profit = sales ex GST − COGS · net_profit = gross_profit − ad spend
          </p>
          {error && (
            <p className="mt-2 text-sm text-amber-400">
              Cube unavailable — charts may be empty. Check CUBE_MCP_URL / SELERIC_API_KEY.
            </p>
          )}
        </div>
        <DateRangeControls
          start={range.start}
          end={range.end}
          spanDays={range.spanDays}
          searchParams={searchParams}
        />
      </header>

      <AgentActivityPanel />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard title="P&L KPI strip" subtitle="Today vs yesterday (IST)" cube="daily_pnl" className="xl:col-span-2">
          <PnlKpiStrip rows={data?.kpiTodayYesterday ?? []} />
        </ChartCard>

        <ChartCard title="Net profit over time" subtitle={`net_profit + gross_profit (sales − COGS) · ${range.spanDays}d`} cube="daily_pnl">
          <TrendChart rows={data?.netProfitTrend ?? []} />
        </ChartCard>

        <ChartCard title="Revenue vs ad spend vs COGS" subtitle="sales ex GST · COGS · ad spend · net profit" cube="daily_pnl">
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
