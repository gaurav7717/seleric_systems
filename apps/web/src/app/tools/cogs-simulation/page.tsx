"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { SimInputPanel } from "@/components/cogs/SimInputPanel"
import { UnitEconomicsGrid } from "@/components/cogs/UnitEconomicsGrid"
import { ScenarioTable } from "@/components/cogs/ScenarioTable"
import { ProductSummaryCard } from "@/components/cogs/ProductSummaryCard"
import { SearchableSelect } from "@/components/cogs/SearchableSelect"
import { simulate, DEFAULT_INPUTS, type SimInputs, type Classification } from "@/lib/cogs-engine"
import {
  groupSkusByProduct,
  matchCampaignsToProducts,
  type RawSkuRow,
  type RawCampaignRow,
  type ProductGroup,
  type VariantData,
} from "@/lib/campaign-sku-matcher"
import { DateRangeSummaryPanel } from "@/components/cogs/DateRangeSummaryPanel"

type ActiveTab = "portfolio" | "calculator"

const BADGE_STYLE: Record<Classification, string> = {
  WINNER:
    "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 ring-1 ring-emerald-200 dark:ring-emerald-800/60",
  BORDERLINE:
    "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-800/60",
  LOSER:
    "bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 ring-1 ring-red-200 dark:ring-red-800/60",
}

const RECOMMEND_STYLE: Record<Classification, string> = {
  WINNER:
    "border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200",
  BORDERLINE:
    "border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200",
  LOSER:
    "border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-950/30 text-red-900 dark:text-red-200",
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function daysAgoStr(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function normalizeDateRange(from: string, to: string): { from: string; to: string } {
  if (!from || !to) return { from, to }
  return from <= to ? { from, to } : { from: to, to: from }
}

interface ApiResponse {
  skus: RawSkuRow[]
  campaigns: RawCampaignRow[]
}

export default function CogsSimulationPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("portfolio")
  const [dateFrom, setDateFrom] = useState(daysAgoStr(30))
  const [dateTo, setDateTo] = useState(todayStr())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [products, setProducts] = useState<ProductGroup[]>([])
  const [selectedBase, setSelectedBase] = useState<string>("")
  const [selectedVariantSku, setSelectedVariantSku] = useState<string>("")
  const [inputs, setInputs] = useState<SimInputs>(DEFAULT_INPUTS)

  const fetchData = useCallback(async () => {
    const { from, to } = normalizeDateRange(dateFrom, dateTo)
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/tools/cogs-data?dateFrom=${from}&dateTo=${to}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: ApiResponse = await res.json()
      const grouped = groupSkusByProduct(data.skus ?? [])
      const matched = matchCampaignsToProducts(grouped, data.campaigns ?? [])
      setProducts(matched)
      if (matched.length > 0 && !selectedBase) {
        setSelectedBase(matched[0].productBase)
        setSelectedVariantSku("")
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    setSelectedVariantSku("")
  }, [selectedBase])

  useEffect(() => {
    if (!selectedBase) return
    const product = products.find((p) => p.productBase === selectedBase)
    if (!product) return

    if (selectedVariantSku) {
      const variant = product.variantData.find((v) => v.sku === selectedVariantSku)
      if (variant) {
        const variantAsp =
          variant.qty > 0 && variant.grossRevenue > 0
            ? Math.round(variant.grossRevenue / variant.qty)
            : variant.asp !== null
              ? Math.round(variant.asp)
              : null
        setInputs((prev) => ({
          ...prev,
          cogs: variant.cogs > 0 ? Math.max(0, Math.round(variant.cogs) - prev.cogsShipping - prev.packaging) : prev.cogs,
          cac: variant.cac > 0 ? Math.round(variant.cac) : prev.cac,
          asp: variantAsp ?? prev.asp,
        }))
        return
      }
      setSelectedVariantSku("")
    }

    const derivedAsp =
      product.totalQty > 0 && product.grossRevenue > 0
        ? Math.round(product.grossRevenue / product.totalQty)
        : product.asp !== null
          ? Math.round(product.asp)
          : null

    setInputs((prev) => ({
      ...prev,
      cogs: product.avgCogs > 0 ? Math.max(0, Math.round(product.avgCogs) - prev.cogsShipping - prev.packaging) : prev.cogs,
      cac: product.cac > 0 ? Math.round(product.cac) : prev.cac,
      asp: derivedAsp ?? prev.asp,
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBase, products, selectedVariantSku])

  const result = useMemo(() => simulate(inputs), [inputs])
  const selectedProduct = products.find((p) => p.productBase === selectedBase)
  const selectedVariant: VariantData | undefined = selectedProduct?.variantData.find(
    (v) => v.sku === selectedVariantSku,
  )

  const handleInputChange = useCallback((patch: Partial<SimInputs>) => {
    setInputs((prev) => ({ ...prev, ...patch }))
  }, [])

  const handleDateFromChange = useCallback((value: string) => {
    setDateFrom(value)
    if (value && dateTo && value > dateTo) setDateTo(value)
  }, [dateTo])

  const handleDateToChange = useCallback((value: string) => {
    setDateTo(value)
    if (value && dateFrom && value < dateFrom) setDateFrom(value)
  }, [dateFrom])

  const handlePortfolioSelect = useCallback((base: string) => {
    setSelectedBase(base)
    setSelectedVariantSku("")
    setActiveTab("calculator")
  }, [])

  const aspLabel = `ASP ₹${inputs.asp.toLocaleString("en-IN")}`

  return (
    <main className="mx-auto max-w-7xl px-4 py-4 sm:px-5 sm:py-6">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900 dark:text-night-50">COGS Simulation</h1>
          <p className="text-sm text-stone-500 dark:text-night-500 mt-0.5">
            Unit economics per product — live COGS &amp; campaign attribution
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-stone-500 dark:text-night-500">From</span>
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => handleDateFromChange(e.target.value)}
              className="rounded border border-stone-300 dark:border-night-700 bg-white dark:bg-night-875 px-2 py-1 text-xs text-stone-900 dark:text-night-50 focus:border-insight-positive focus:outline-none [color-scheme:light] dark:[color-scheme:dark]"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-stone-500 dark:text-night-500">To</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => handleDateToChange(e.target.value)}
              className="rounded border border-stone-300 dark:border-night-700 bg-white dark:bg-night-875 px-2 py-1 text-xs text-stone-900 dark:text-night-50 focus:border-insight-positive focus:outline-none [color-scheme:light] dark:[color-scheme:dark]"
            />
          </label>
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="rounded bg-insight-positive px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? "…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="mb-4 flex gap-1 border-b border-stone-200 dark:border-night-800">
        <button
          type="button"
          onClick={() => setActiveTab("portfolio")}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === "portfolio"
              ? "border-insight-positive text-insight-positive"
              : "border-transparent text-stone-500 dark:text-night-500 hover:text-stone-700 dark:hover:text-night-300"
          }`}
        >
          Portfolio
          {products.length > 0 && (
            <span className="ml-1.5 rounded-full bg-stone-100 dark:bg-night-800 px-1.5 py-0.5 text-[10px] font-semibold text-stone-500 dark:text-night-500">
              {products.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("calculator")}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === "calculator"
              ? "border-insight-positive text-insight-positive"
              : "border-transparent text-stone-500 dark:text-night-500 hover:text-stone-700 dark:hover:text-night-300"
          }`}
        >
          COGS Calculator
          {selectedBase && (
            <span className="ml-1.5 rounded-full bg-stone-100 dark:bg-night-800 px-1.5 py-0.5 text-[10px] font-semibold text-stone-500 dark:text-night-500 max-w-[120px] truncate inline-block align-middle">
              {selectedBase}
            </span>
          )}
        </button>
      </div>

      {/* Loading / error states */}
      {loading && (
        <div className="mb-3 flex items-center gap-2 text-xs text-stone-500 dark:text-night-500">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-stone-300 dark:border-night-700 border-t-insight-positive" />
          Loading product &amp; campaign data…
        </div>
      )}
      {error && (
        <div className="mb-3 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-xs text-insight-negative">
          Failed to load data: {error}. Manual simulation still works.
        </div>
      )}

      {/* ── Portfolio tab ── */}
      {activeTab === "portfolio" && (
        <>
          {!loading && products.length === 0 && !error && (
            <p className="text-xs text-stone-500 dark:text-night-500">
              No products found for the selected date range.
            </p>
          )}
          {products.length > 0 && (
            <DateRangeSummaryPanel
              products={products}
              sharedInputs={inputs}
              selectedBase={selectedBase}
              onSelect={handlePortfolioSelect}
            />
          )}
        </>
      )}

      {/* ── COGS Calculator tab ── */}
      {activeTab === "calculator" && (
        <>
          {/* Product + variant selector */}
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-insight-border dark:border-night-800 bg-white dark:bg-night-900 px-3 py-2 shadow-sm dark:shadow-none">
            {products.length > 0 ? (
              <SearchableSelect
                value={selectedBase}
                onChange={setSelectedBase}
                options={products.map((p) => ({
                  value: p.productBase,
                  label: `${p.productBase} — ${p.productTitle.slice(0, 48)}`,
                }))}
                placeholder="— Select product —"
                className="min-w-0 flex-1 sm:max-w-md"
              />
            ) : (
              <span className="text-xs text-stone-500 dark:text-night-500">No products loaded — use manual inputs below</span>
            )}
            {selectedProduct && selectedProduct.variantData.length > 1 && (
              <SearchableSelect
                value={selectedVariantSku}
                onChange={setSelectedVariantSku}
                options={[
                  { value: "", label: "All variants" },
                  ...selectedProduct.variantData.map((v) => ({
                    value: v.sku,
                    label: `${v.sku} (${v.qty} u)`,
                  })),
                ]}
                placeholder="All variants"
                inputClassName="text-xs"
              />
            )}
            {selectedBase && (
              <>
                <span
                  className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${BADGE_STYLE[result.classification]}`}
                >
                  {result.classification}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-stone-500 dark:text-night-500">{aspLabel}</span>
              </>
            )}
          </div>

          {/* Product summary + recommendation */}
          {selectedProduct && (
            <div className="mb-3 space-y-2">
              {!selectedVariantSku && selectedProduct.variants.length > 1 && (
                <p className="truncate text-[10px] text-stone-400 dark:text-night-600">
                  Variants: {selectedProduct.variants.join(", ")}
                </p>
              )}
              <ProductSummaryCard
                product={selectedProduct}
                variant={selectedVariant}
                cogsShipping={inputs.cogsShipping}
                packaging={inputs.packaging}
              />
              <p
                className={`rounded-lg border px-3 py-2 text-xs leading-snug ${RECOMMEND_STYLE[result.classification]}`}
              >
                {result.recommendation}
              </p>
            </div>
          )}

          {!selectedBase && !loading && products.length === 0 && (
            <p className="mb-3 text-xs text-stone-500 dark:text-night-500">
              Adjust assumptions below to run a manual simulation.
            </p>
          )}

          {/* Sim panels */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 lg:items-start">
            <div className="lg:col-span-5">
              <SimInputPanel inputs={inputs} onChange={handleInputChange} />
            </div>
            <div className="flex flex-col gap-3 lg:col-span-7">
              <UnitEconomicsGrid result={result} targetProfit={inputs.targetAbsoluteProfit} />
              <ScenarioTable rows={result.scenarios} currentCogs={result.productCost} />
            </div>
          </div>
        </>
      )}
    </main>
  )
}
