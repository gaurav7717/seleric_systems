"use client"

import type { ProductGroup, VariantData } from "@/lib/campaign-sku-matcher"
import { MetricTile } from "./MetricTile"

const fmt = (n: number) =>
  `₹${Math.round(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`

export function ProductSummaryCard({
  product,
  variant,
  cogsShipping = 0,
  packaging = 0,
}: {
  product: ProductGroup
  variant?: VariantData
  cogsShipping?: number
  packaging?: number
}) {
  if (variant) {
    const variantAsp =
      variant.asp !== null
        ? fmt(variant.asp)
        : variant.qty > 0 && variant.grossRevenue > 0
          ? fmt(variant.grossRevenue / variant.qty)
          : "—"

    return (
      <div className="rounded-xl border border-insight-border dark:border-night-800 bg-white dark:bg-night-900 p-3 shadow-sm dark:shadow-none">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-stone-500 dark:text-night-500">
          Variant data — {variant.sku}
          <span className="ml-2 normal-case text-stone-400 dark:text-night-600">
            ({(variant.qtyShare * 100).toFixed(0)}% of {product.productBase} qty)
          </span>
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <MetricTile
            label="Units sold"
            value={variant.qty.toLocaleString("en-IN")}
            sub={`${(variant.qtyShare * 100).toFixed(0)}% of product`}
            compact
          />
          <MetricTile
            label="Effective product cost"
            value={fmt(Math.max(0, variant.cogs - cogsShipping - packaging))}
            sub={`₹${Math.round(variant.cogs)} − ship ₹${cogsShipping} − pkg ₹${packaging}`}
            compact
          />
          <MetricTile
            label="Gross sales"
            value={variant.grossRevenue > 0 ? fmt(variant.grossRevenue) : "—"}
            sub={`ASP ${variantAsp}`}
            compact
          />
          <MetricTile
            label="Net rev (ex-GST)"
            value={variant.netRevenueExGst > 0 ? fmt(variant.netRevenueExGst) : "—"}
            compact
          />
          <MetricTile
            label="Alloc. ad spend"
            value={variant.allocatedAdSpend > 0 ? fmt(variant.allocatedAdSpend) : "—"}
            sub={
              variant.allocatedPurchases > 0
                ? `${variant.allocatedPurchases} purch · CAC ${fmt(variant.cac)}`
                : "Qty-share allocated"
            }
            compact
          />
        </div>
        {product.matchedCampaigns.length > 0 && (
          <p className="mt-2 truncate text-[10px] text-stone-400 dark:text-night-600">
            Campaigns: {product.matchedCampaigns.slice(0, 3).join(" · ")}
            {product.matchedCampaigns.length > 3 && ` +${product.matchedCampaigns.length - 3}`}
          </p>
        )}
      </div>
    )
  }

  const aspDisplay =
    product.asp !== null
      ? fmt(product.asp)
      : product.totalQty > 0 && product.grossRevenue > 0
        ? fmt(product.grossRevenue / product.totalQty)
        : "—"

  return (
    <div className="rounded-xl border border-insight-border dark:border-night-800 bg-white dark:bg-night-900 p-3 shadow-sm dark:shadow-none">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-stone-500 dark:text-night-500">
        Period data — {product.productBase}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <MetricTile
          label="Units sold"
          value={product.totalQty.toLocaleString("en-IN")}
          sub={product.variants.length > 1 ? `${product.variants.length} variants` : undefined}
          compact
        />
        <MetricTile
          label="Effective product cost"
          value={fmt(Math.max(0, product.avgCogs - cogsShipping - packaging))}
          sub={`₹${Math.round(product.avgCogs)} − ship ₹${cogsShipping} − pkg ₹${packaging}`}
          compact
        />
        <MetricTile
          label="Gross sales"
          value={product.grossRevenue > 0 ? fmt(product.grossRevenue) : "—"}
          sub={`ASP ${aspDisplay}`}
          compact
        />
        <MetricTile
          label="Net rev (ex-GST)"
          value={product.netRevenueExGst > 0 ? fmt(product.netRevenueExGst) : "—"}
          compact
        />
        <MetricTile
          label="Ad spend"
          value={product.adSpend > 0 ? fmt(product.adSpend) : "—"}
          sub={
            product.adPurchases > 0
              ? `${product.adPurchases} purch · CAC ${fmt(product.cac)}`
              : product.matchedCampaigns.length === 0
                ? "No campaigns"
                : undefined
          }
          compact
        />
      </div>
      {product.matchedCampaigns.length > 0 && (
        <p className="mt-2 truncate text-[10px] text-stone-400 dark:text-night-600">
          {product.matchedCampaigns.slice(0, 3).join(" · ")}
          {product.matchedCampaigns.length > 3 && ` +${product.matchedCampaigns.length - 3}`}
        </p>
      )}
    </div>
  )
}
