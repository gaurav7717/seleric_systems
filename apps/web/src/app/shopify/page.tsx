import { ChartCard } from "@/components/charts/ChartCard"
import { ComboLineBarChart } from "@/components/charts/ComboLineBarChart"
import { DonutChart } from "@/components/charts/DonutChart"
import { GroupedBarChart } from "@/components/charts/GroupedBarChart"
import { HorizontalBarChart } from "@/components/charts/HorizontalBarChart"
import { RankedList } from "@/components/charts/RankedList"
import { StackedAreaChart } from "@/components/charts/StackedAreaChart"
import { StackedBarChart } from "@/components/charts/StackedBarChart"
import { DataTable } from "@/components/chat/DataTable"
import { TrendChart } from "@/components/chat/TrendChart"
import { daysAgoIST, todayIST } from "@/lib/chat/dates"
import { geoLabel, skuLabel, utmLabel } from "@/lib/dashboard/page-helpers"
import { fetchShopifyDashboardData } from "@/lib/dashboard/queries/shopify"

export const revalidate = 60

export default async function ShopifyPage() {
  const end = todayIST()
  const start = daysAgoIST(30)

  let data
  let error: string | null = null
  try {
    data = await fetchShopifyDashboardData(30)
  } catch (e) {
    error = String(e)
    data = null
  }

  const geoRows =
    data?.revenueByGeo.map((r) => ({
      ...r,
      geo: geoLabel(r),
    })) ?? []

  const utmDonut = (data?.utmBreakdown ?? []).slice(0, 6).map((r) => ({
    name: utmLabel(r),
    value: Number(r["shopify_orders.gross_revenue"] ?? 0),
  }))

  const fulfillmentDonut = (data?.fulfillmentMix ?? []).map((r) => ({
    name: String(r["shopify_orders.fulfillment_status"] ?? "Unknown"),
    value: Number(r["shopify_orders.orders"] ?? 0),
  }))

  const marginRows =
    data?.marginBySku.map((r) => ({
      ...r,
      label: skuLabel(r),
    })) ?? []

  return (
    <main className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-stone-900">Shopify Store</h1>
        <p className="text-sm text-stone-500 mt-1">
          Store & product analytics · {start} → {end} · created_at_ist (IST)
        </p>
        {error && (
          <p className="mt-2 text-sm text-amber-400">
            Cube unavailable — charts may be empty. Check CUBE_MCP_URL / SELERIC_API_KEY.
          </p>
        )}
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard title="Revenue & orders daily" subtitle="net_orders bar · gross revenue + AOV lines" cube="shopify_orders">
          <ComboLineBarChart
            rows={data?.revenueOrdersDaily ?? []}
            barMeasures={["shopify_orders.net_orders"]}
            lineMeasures={["shopify_orders.gross_revenue", "shopify_orders.aov"]}
          />
        </ChartCard>

        <ChartCard title="Top products by units sold" subtitle="Ranked by total_quantity · shopify_order_line_items" cube="shopify_order_line_items">
          <HorizontalBarChart
            rows={data?.topProducts ?? []}
            labelKey="shopify_order_line_items.product_title"
            measureKeys={["shopify_order_line_items.total_quantity"]}
          />
        </ChartCard>

        <ChartCard title="Return rate trend" subtitle="return_rate pre-filtered: RETURNED + IN_PROGRESS only" cube="shopify_orders">
          <ComboLineBarChart
            rows={data?.returnCancel ?? []}
            barMeasures={["shopify_orders.returned_orders"]}
            lineMeasures={["shopify_orders.return_rate"]}
          />
        </ChartCard>

        <ChartCard title="Revenue by geography" subtitle="Country · province ranked" cube="shopify_orders">
          <RankedList
            rows={geoRows}
            labelKey="geo"
            valueKey="shopify_orders.gross_revenue"
            countKey="shopify_orders.net_orders"
          />
        </ChartCard>

        <ChartCard title="UTM source breakdown" subtitle="Donut + table" cube="shopify_orders">
          <DonutChart slices={utmDonut} />
          <DataTable rows={(data?.utmBreakdown ?? []).slice(0, 8)} />
        </ChartCard>

        <ChartCard title="Discount impact" subtitle="Daily discounts vs net revenue" cube="shopify_order_line_items">
          <GroupedBarChart rows={data?.discountImpact ?? []} />
        </ChartCard>

        <ChartCard title="Units per order" subtitle="Basket size over time" cube="shopify_order_line_items">
          <TrendChart rows={data?.unitsPerOrder ?? []} />
        </ChartCard>

        <ChartCard title="Fulfillment status mix" subtitle="Period total" cube="shopify_orders">
          <DonutChart slices={fulfillmentDonut} />
        </ChartCard>

        <ChartCard title="Units sold by SKU" subtitle="total_quantity ranked by SKU" cube="shopify_order_line_items">
          <HorizontalBarChart
            rows={marginRows}
            labelKey="label"
            measureKeys={["shopify_order_line_items.total_quantity"]}
            height={320}
          />
        </ChartCard>

        <ChartCard title="Shipping revenue contribution" subtitle="Stacked area daily" cube="shopify_orders">
          <StackedAreaChart
            rows={data?.shippingRevenue ?? []}
            series={[
              { label: "Gross revenue", measure: "shopify_orders.gross_revenue" },
              { label: "Shipping revenue", measure: "shopify_orders.shipping_revenue" },
            ]}
          />
        </ChartCard>
      </div>
    </main>
  )
}
