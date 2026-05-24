"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { SimInputPanel } from "@/components/cogs/SimInputPanel"
import { UnitEconomicsGrid } from "@/components/cogs/UnitEconomicsGrid"
import { ScenarioTable } from "@/components/cogs/ScenarioTable"
import { ProductSummaryCard } from "@/components/cogs/ProductSummaryCard"
import { simulate, DEFAULT_INPUTS, type SimInputs, type Classification } from "@/lib/cogs-engine"
import {
  groupSkusByProduct,
  matchCampaignsToProducts,
  type RawSkuRow,
  type RawCampaignRow,
  type ProductGroup,
  type VariantData,
} from "@/lib/campaign-sku-matcher"

const BADGE_STYLE: Record<Classification, string> = {
  WINNER: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
  BORDERLINE: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  LOSER: "bg-red-50 text-red-800 ring-1 ring-red-200",
}

const RECOMMEND_STYLE: Record<Classification, string> = {
  WINNER: "border-emerald-200 bg-emerald-50 text-emerald-900",
  BORDERLINE: "border-amber-200 bg-amber-50 text-amber-900",
  LOSER: "border-red-200 bg-red-50 text-red-900",
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
          cogs: variant.cogs > 0 ? Math.round(variant.cogs) : prev.cogs,
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
      cogs: product.avgCogs > 0 ? Math.round(product.avgCogs) : prev.cogs,
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

  const aspLabel = `ASP ₹${inputs.asp.toLocaleString("en-IN")}`

  return (
    <main className="mx-auto max-w-7xl px-4 py-4 sm:px-5 sm:py-6">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">COGS Simulation</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Unit economics per product — live COGS &amp; campaign attribution
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-stone-500">From</span>
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => handleDateFromChange(e.target.value)}
              className="rounded border border-stone-300 bg-white px-2 py-1 text-xs text-stone-900 focus:border-insight-positive focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-stone-500">To</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => handleDateToChange(e.target.value)}
              className="rounded border border-stone-300 bg-white px-2 py-1 text-xs text-stone-900 focus:border-insight-positive focus:outline-none"
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

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-insight-border bg-white px-3 py-2 shadow-sm">
        {products.length > 0 ? (
          <select
            value={selectedBase}
            onChange={(e) => setSelectedBase(e.target.value)}
            className="min-w-0 flex-1 rounded border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-900 focus:border-insight-positive focus:outline-none sm:max-w-md"
          >
            <option value="">— Select product —</option>
            {products.map((p) => (
              <option key={p.productBase} value={p.productBase}>
                {p.productBase} — {p.productTitle.slice(0, 48)}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-stone-500">No products loaded — use manual inputs below</span>
        )}
        {selectedProduct && selectedProduct.variantData.length > 1 && (
          <select
            value={selectedVariantSku}
            onChange={(e) => setSelectedVariantSku(e.target.value)}
            className="rounded border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-900 focus:border-insight-positive focus:outline-none"
          >
            <option value="">All variants</option>
            {selectedProduct.variantData.map((v) => (
              <option key={v.sku} value={v.sku}>
                {v.sku} ({v.qty} u)
              </option>
            ))}
          </select>
        )}
        {selectedBase && (
          <>
            <span
              className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${BADGE_STYLE[result.classification]}`}
            >
              {result.classification}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-stone-500">{aspLabel}</span>
          </>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-insight-negative">
          Failed to load data: {error}. Manual simulation still works.
        </div>
      )}

      {loading && (
        <div className="mb-3 flex items-center gap-2 text-xs text-stone-500">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-stone-300 border-t-insight-positive" />
          Loading product &amp; campaign data…
        </div>
      )}

      {selectedProduct && (
        <div className="mb-3 space-y-2">
          {!selectedVariantSku && selectedProduct.variants.length > 1 && (
            <p className="truncate text-[10px] text-stone-400">
              Variants: {selectedProduct.variants.join(", ")}
            </p>
          )}
          <ProductSummaryCard product={selectedProduct} variant={selectedVariant} />
          <p
            className={`rounded-lg border px-3 py-2 text-xs leading-snug ${RECOMMEND_STYLE[result.classification]}`}
          >
            {result.recommendation}
          </p>
        </div>
      )}

      {!selectedBase && !loading && products.length === 0 && (
        <p className="mb-3 text-xs text-stone-500">
          Adjust assumptions below to run a manual simulation.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 lg:items-start">
        <div className="lg:col-span-5">
          <SimInputPanel inputs={inputs} onChange={handleInputChange} />
        </div>
        <div className="flex flex-col gap-3 lg:col-span-7">
          <UnitEconomicsGrid result={result} targetProfit={inputs.targetAbsoluteProfit} />
          <ScenarioTable rows={result.scenarios} currentCogs={inputs.cogs} />
        </div>
      </div>
    </main>
  )
}
