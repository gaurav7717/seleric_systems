import { ChartCard } from "@/components/charts/ChartCard"
import { ComboLineBarChart } from "@/components/charts/ComboLineBarChart"
import { FunnelChart } from "@/components/charts/FunnelChart"
import { HorizontalBarChart } from "@/components/charts/HorizontalBarChart"
import { HourlyBarChart } from "@/components/charts/ComparisonBarChart"
import { PeriodCompareKpis } from "@/components/charts/PeriodCompareKpis"
import { DataTable } from "@/components/chat/DataTable"
import { KpiCards } from "@/components/chat/KpiCards"
import { TrendChart } from "@/components/chat/TrendChart"
import { DateRangeControls } from "@/components/dashboard/DateRangeControls"
import { funnelFromAggregate } from "@/lib/dashboard/page-helpers"
import { fetchAdsDashboardData } from "@/lib/dashboard/queries/ads"
import {
  dateRangeLabel,
  parseDashboardDateRange,
  type DashboardSearchParams,
} from "@/lib/dashboard/date-ranges"

export const revalidate = 60

export default async function AdsPage({
  searchParams,
}: {
  searchParams?: DashboardSearchParams
}) {
  const range = parseDashboardDateRange(searchParams)
  const rangeLabel = dateRangeLabel(range)

  let data
  let error: string | null = null
  try {
    data = await fetchAdsDashboardData(range)
  } catch (e) {
    error = String(e)
    data = null
  }

  const currentPeriod = data?.cpcCpmCpaCurrent[0] ?? {}
  const priorPeriod = data?.cpcCpmCpaPrior[0] ?? {}
  const funnelRow = data?.purchaseFunnel[0] ?? {}

  return (
    <main className="p-6 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900 dark:text-night-50">Meta Ads</h1>
          <p className="text-sm text-stone-500 dark:text-night-500 mt-1">
            Ad performance & attribution · {rangeLabel} · ROAS = purchase_value / ad_spend
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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard title="Ad spend + ROAS daily" subtitle="Spend ₹ left · ROAS right" cube="marketing_performance">
          <TrendChart rows={data?.spendRoasDaily ?? []} />
        </ChartCard>

        <ChartCard title="Impressions vs clicks vs CTR" subtitle="Bars + CTR line" cube="marketing_performance">
          <ComboLineBarChart
            rows={data?.impressionsClicks ?? []}
            barMeasures={[
              "marketing_performance.impressions",
              "marketing_performance.clicks",
            ]}
            lineMeasures={["marketing_performance.ctr"]}
          />
        </ChartCard>

        <ChartCard title="CPC · CPM · CPA" subtitle={`${range.spanDays}d vs prior ${range.spanDays}d`} cube="marketing_performance">
          <PeriodCompareKpis
            current={currentPeriod}
            prior={priorPeriod}
            metrics={[
              { label: "CPC", key: "marketing_performance.cpc", format: "currency" },
              { label: "CPM", key: "marketing_performance.cpm", format: "currency" },
              { label: "CPA", key: "cpa", format: "currency" },
            ]}
          />
        </ChartCard>

        <ChartCard title="Top campaigns by ROAS" subtitle="Top 10 · pixel ROAS" cube="marketing_performance">
          <HorizontalBarChart
            rows={data?.topCampaignsRoas ?? []}
            labelKey="marketing_performance.campaign_name"
            measureKeys={["marketing_performance.roas", "marketing_performance.ad_spend"]}
          />
        </ChartCard>

        <ChartCard title="Adset performance table" subtitle="Campaign × adset" cube="marketing_performance" className="xl:col-span-2">
          <DataTable rows={data?.adsetTable ?? []} label="Adsets" />
        </ChartCard>

        <ChartCard title="Purchase funnel" subtitle="link_clicks after impressions" cube="marketing_performance">
          <FunnelChart steps={funnelFromAggregate(funnelRow)} />
        </ChartCard>

        <ChartCard title="Spend & ROAS by hour" subtitle="hourly_window dimension" cube="ad_performance">
          <HourlyBarChart
            rows={data?.spendByHour ?? []}
            labelKey="ad_performance.hourly_window"
            measureKey="ad_performance.ad_spend"
          />
        </ChartCard>

        <ChartCard title="Attribution by campaign" subtitle="Attributed revenue & gross profit" cube="dw_meta_ads_attribution">
          <HorizontalBarChart
            rows={data?.attributionByCampaign ?? []}
            labelKey="dw_meta_ads_attribution.campaign_name"
            measureKeys={[
              "dw_meta_ads_attribution.attributed_revenue",
              "dw_meta_ads_attribution.attributed_gross_profit",
            ]}
            height={320}
          />
        </ChartCard>

        <ChartCard title="Video & engagement KPIs" subtitle="Period totals + daily trend" cube="ad_performance" className="xl:col-span-2">
          <KpiCards rows={data?.engagementPeriod ?? []} />
          <TrendChart rows={data?.engagementDaily ?? []} />
        </ChartCard>
      </div>
    </main>
  )
}
