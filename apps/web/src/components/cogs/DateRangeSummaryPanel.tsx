"use client"

import { useMemo, useState } from "react"
import { simulate, type SimInputs, type Classification } from "@/lib/cogs-engine"
import { type ProductGroup } from "@/lib/campaign-sku-matcher"

const BADGE_CLS: Record<Classification, string> = {
  WINNER:
    "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-200 dark:ring-emerald-800/60",
  BORDERLINE:
    "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-800/60",
  LOSER:
    "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 ring-1 ring-red-200 dark:ring-red-800/60",
}

const BADGE_ACTIVE_CLS: Record<Classification, string> = {
  WINNER:
    "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 ring-2 ring-emerald-500 dark:ring-emerald-500",
  BORDERLINE:
    "bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 ring-2 ring-amber-500 dark:ring-amber-500",
  LOSER:
    "bg-red-100 dark:bg-red-900/60 text-red-800 dark:text-red-200 ring-2 ring-red-500 dark:ring-red-500",
}

const CARD_LEFT: Record<Classification, string> = {
  WINNER: "border-l-2 border-l-emerald-400 dark:border-l-emerald-600",
  BORDERLINE: "border-l-2 border-l-amber-400 dark:border-l-amber-600",
  LOSER: "border-l-2 border-l-red-400 dark:border-l-red-600",
}

const CARD_RING_SELECTED: Record<Classification, string> = {
  WINNER: "ring-2 ring-emerald-500",
  BORDERLINE: "ring-2 ring-amber-500",
  LOSER: "ring-2 ring-red-500",
}

const PROFIT_CLS = (n: number) =>
  n > 0
    ? "text-emerald-600 dark:text-emerald-400"
    : n < 0
      ? "text-red-600 dark:text-red-400"
      : "text-stone-500 dark:text-night-500"

function fmtProfit(n: number): string {
  const abs = `₹${Math.abs(Math.round(n)).toLocaleString("en-IN")}`
  return n >= 0 ? `+${abs}` : `-${abs}`
}

function fmtK(n: number): string {
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(0)}K`
  return `₹${Math.round(n).toLocaleString("en-IN")}`
}

interface ProductEntry {
  productBase: string
  productTitle: string
  classification: Classification
  netProfit: number
  grossRevenue: number
  totalQty: number
}

interface DateRangeSummaryPanelProps {
  products: ProductGroup[]
  sharedInputs: SimInputs
  selectedBase: string
  onSelect: (base: string) => void
}

export function DateRangeSummaryPanel({
  products,
  sharedInputs,
  selectedBase,
  onSelect,
}: DateRangeSummaryPanelProps) {
  const [activeFilter, setActiveFilter] = useState<Classification | null>(null)

  const entries = useMemo<ProductEntry[]>(() => {
    return products
      .map((p) => {
        const asp =
          p.totalQty > 0 && p.grossRevenue > 0
            ? Math.round(p.grossRevenue / p.totalQty)
            : p.asp != null
              ? Math.round(p.asp)
              : sharedInputs.asp

        // strip fixed ship+pkg from DB effective COGS to get product cost only
        // (engine adds them back internally as effectiveCogs = cogs + cogsShipping + packaging)
        const cogs =
          p.avgCogs > 0
            ? Math.max(0, Math.round(p.avgCogs) - sharedInputs.cogsShipping - sharedInputs.packaging)
            : sharedInputs.cogs
        const cac = p.cac > 0 ? Math.round(p.cac) : sharedInputs.cac

        const result = simulate({ ...sharedInputs, asp, cogs, cac })
        return {
          productBase: p.productBase,
          productTitle: p.productTitle,
          classification: result.classification,
          netProfit: result.netProfit,
          grossRevenue: p.grossRevenue,
          totalQty: p.totalQty,
        }
      })
      .sort((a, b) => b.grossRevenue - a.grossRevenue)
  }, [products, sharedInputs])

  const summary = useMemo(() => {
    const s = { WINNER: { count: 0, rev: 0 }, BORDERLINE: { count: 0, rev: 0 }, LOSER: { count: 0, rev: 0 } }
    for (const e of entries) {
      s[e.classification].count++
      s[e.classification].rev += e.grossRevenue
    }
    return s
  }, [entries])

  if (products.length === 0) return null

  return (
    <div className="mb-3 rounded-xl border border-insight-border dark:border-night-800 bg-white dark:bg-night-900 px-3 py-2.5 shadow-sm dark:shadow-none">
      {/* Summary pills */}
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 dark:text-night-600">
          Portfolio
        </span>
        {(["WINNER", "BORDERLINE", "LOSER"] as Classification[]).map((cls) => {
          const { count, rev } = summary[cls]
          if (count === 0) return null
          const isActive = activeFilter === cls
          return (
            <button
              key={cls}
              type="button"
              onClick={() => setActiveFilter(isActive ? null : cls)}
              className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide transition-all cursor-pointer ${isActive ? BADGE_ACTIVE_CLS[cls] : BADGE_CLS[cls]} hover:opacity-80`}
            >
              {count}&nbsp;{cls === "BORDERLINE" ? "Borderline" : cls === "WINNER" ? `Winner${count !== 1 ? "s" : ""}` : `Loser${count !== 1 ? "s" : ""}`}
              <span className="ml-1 font-normal opacity-70">· {fmtK(rev)}</span>
            </button>
          )
        })}
        <span className="ml-auto text-[10px] text-stone-400 dark:text-night-600">
          {activeFilter
            ? `${summary[activeFilter].count} shown · click pill to clear`
            : `${products.length} SKU${products.length !== 1 ? "s" : ""} · click to open calculator`}
        </span>
      </div>

      {/* Product cards */}
      <div className="flex flex-wrap gap-1.5">
        {(activeFilter ? entries.filter((e) => e.classification === activeFilter) : entries).map((e) => {
          const isSelected = e.productBase === selectedBase
          return (
            <button
              key={e.productBase}
              type="button"
              onClick={() => onSelect(e.productBase)}
              className={`rounded-lg px-2.5 py-1.5 text-left transition-all border border-insight-border dark:border-night-800 bg-white dark:bg-night-875 hover:bg-stone-50 dark:hover:bg-night-850 ${CARD_LEFT[e.classification]} ${isSelected ? CARD_RING_SELECTED[e.classification] : ""}`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={`rounded px-1.5 py-0 text-[9px] font-bold uppercase tracking-wide ${BADGE_CLS[e.classification]}`}>
                  {e.classification === "BORDERLINE" ? "BDL" : e.classification.slice(0, 3)}
                </span>
                <span className={`text-[10px] font-semibold tabular-nums ${PROFIT_CLS(e.netProfit)}`}>
                  {fmtProfit(e.netProfit)}/u
                </span>
              </div>
              <p className="max-w-[140px] truncate text-[10px] font-medium text-stone-700 dark:text-night-300 leading-tight">
                {e.productBase}
              </p>
              <p className="text-[9px] text-stone-400 dark:text-night-600 tabular-nums leading-tight mt-0.5">
                {e.totalQty.toLocaleString("en-IN")}u · {fmtK(e.grossRevenue)}
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
