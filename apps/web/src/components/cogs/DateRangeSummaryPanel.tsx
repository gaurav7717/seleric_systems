"use client"

import { useMemo, useState } from "react"
import { simulate, type SimInputs, type Classification } from "@/lib/cogs-engine"
import { type ProductGroup } from "@/lib/campaign-sku-matcher"

type FilterTab = "ALL" | Classification

const BADGE_CLS: Record<Classification, string> = {
  WINNER:
    "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-200 dark:ring-emerald-800/60",
  BORDERLINE:
    "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-800/60",
  LOSER:
    "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 ring-1 ring-red-200 dark:ring-red-800/60",
}

const ROW_LEFT: Record<Classification, string> = {
  WINNER: "border-l-2 border-l-emerald-400 dark:border-l-emerald-600",
  BORDERLINE: "border-l-2 border-l-amber-400 dark:border-l-amber-600",
  LOSER: "border-l-2 border-l-red-400 dark:border-l-red-600",
}

const PROFIT_CLS = (n: number) =>
  n > 0
    ? "text-emerald-600 dark:text-emerald-400"
    : n < 0
      ? "text-red-600 dark:text-red-400"
      : "text-stone-400 dark:text-night-600"

function fmtProfit(n: number): string {
  const abs = `₹${Math.abs(Math.round(n)).toLocaleString("en-IN")}`
  return n >= 0 ? `+${abs}` : `-${abs}`
}

function fmtK(n: number): string {
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(0)}K`
  return `₹${Math.round(n).toLocaleString("en-IN")}`
}

function fmtCcy(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`
}

interface ProductEntry {
  productBase: string
  productTitle: string
  classification: Classification
  netProfit: number
  cmPercent: number
  roas: number
  grossRevenue: number
  totalQty: number
  asp: number
  effectiveCogs: number
  totalCogs: number
  cogs: number
  cac: number
  adSpend: number
}

interface DateRangeSummaryPanelProps {
  products: ProductGroup[]
  sharedInputs: SimInputs
  selectedBase: string
  onSelect: (base: string) => void
}

type SortKey = "grossRevenue" | "totalQty" | "netProfit" | "roas" | "cac"
type SortDir = "asc" | "desc"

export function DateRangeSummaryPanel({
  products,
  sharedInputs,
  selectedBase,
  onSelect,
}: DateRangeSummaryPanelProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL")
  const [sortKey, setSortKey] = useState<SortKey>("grossRevenue")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const entries = useMemo<ProductEntry[]>(() => {
    return products.map((p) => {
      const asp =
        p.totalQty > 0 && p.grossRevenue > 0
          ? Math.round(p.grossRevenue / p.totalQty)
          : p.asp != null
            ? Math.round(p.asp)
            : sharedInputs.asp

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
        cmPercent: result.cmPercent,
        roas: result.roas,
        grossRevenue: p.grossRevenue,
        totalQty: p.totalQty,
        asp,
        effectiveCogs: p.avgCogs > 0 ? Math.round(p.avgCogs) : cogs + sharedInputs.cogsShipping + sharedInputs.packaging,
        totalCogs: Math.round(p.avgCogs * p.totalQty),
        cogs,
        cac,
        adSpend: p.adSpend,
      }
    })
  }, [products, sharedInputs])

  const counts = useMemo(() => {
    const s = { WINNER: 0, BORDERLINE: 0, LOSER: 0 }
    for (const e of entries) s[e.classification]++
    return s
  }, [entries])

  const filtered = useMemo(() => {
    const base = activeTab === "ALL" ? entries : entries.filter((e) => e.classification === activeTab)
    return [...base].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      return sortDir === "desc" ? bv - av : av - bv
    })
  }, [entries, activeTab, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="ml-0.5 opacity-25">↕</span>
    return <span className="ml-0.5 opacity-70">{sortDir === "desc" ? "↓" : "↑"}</span>
  }

  const thCls =
    "px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-night-600 whitespace-nowrap select-none"
  const thClickCls = `${thCls} cursor-pointer hover:text-stone-600 dark:hover:text-night-300 transition-colors`

  if (products.length === 0) return null

  const TABS: { key: FilterTab; label: string; count?: number }[] = [
    { key: "ALL", label: "All", count: entries.length },
    { key: "WINNER", label: "Winners", count: counts.WINNER },
    { key: "BORDERLINE", label: "Borderline", count: counts.BORDERLINE },
    { key: "LOSER", label: "Losers", count: counts.LOSER },
  ]

  const TAB_ACTIVE: Record<FilterTab, string> = {
    ALL: "border-stone-500 text-stone-700 dark:text-night-200",
    WINNER: "border-emerald-500 text-emerald-700 dark:text-emerald-300",
    BORDERLINE: "border-amber-500 text-amber-700 dark:text-amber-300",
    LOSER: "border-red-500 text-red-700 dark:text-red-300",
  }
  const TAB_COUNT: Record<FilterTab, string> = {
    ALL: "bg-stone-100 dark:bg-night-800 text-stone-500 dark:text-night-500",
    WINNER: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400",
    BORDERLINE: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400",
    LOSER: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400",
  }

  return (
    <div className="rounded-xl border border-insight-border dark:border-night-800 bg-white dark:bg-night-900 shadow-sm dark:shadow-none overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b border-stone-200 dark:border-night-800 px-3">
        {TABS.map(({ key, label, count }) => {
          const isActive = activeTab === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
                isActive
                  ? TAB_ACTIVE[key]
                  : "border-transparent text-stone-400 dark:text-night-600 hover:text-stone-600 dark:hover:text-night-400"
              }`}
            >
              {label}
              {count !== undefined && count > 0 && (
                <span className={`rounded-full px-1.5 py-0 text-[9px] font-bold ${isActive ? TAB_COUNT[key] : "bg-stone-100 dark:bg-night-800 text-stone-400 dark:text-night-600"}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
        <span className="ml-auto text-[10px] text-stone-400 dark:text-night-600 pr-1">
          Click row → open calculator
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-xs">
          <thead>
            <tr className="border-b border-stone-100 dark:border-night-800 bg-stone-50 dark:bg-night-875">
              <th className={thCls} style={{ width: 80 }}>Status</th>
              <th className={thCls}>Product</th>
              <th className={thClickCls} onClick={() => toggleSort("totalQty")} style={{ width: 80 }}>
                Units <SortIcon col="totalQty" />
              </th>
              <th className={thClickCls} onClick={() => toggleSort("grossRevenue")} style={{ width: 100 }}>
                Revenue <SortIcon col="grossRevenue" />
              </th>
              <th className={thCls} style={{ width: 72 }}>ASP</th>
              <th className={thCls} style={{ width: 72 }}>COGS/u</th>
              <th className={thCls} style={{ width: 88 }}>Total COGS</th>
              <th className={thCls} style={{ width: 72 }}>Prod. Cost</th>
              <th className={thClickCls} onClick={() => toggleSort("cac")} style={{ width: 72 }}>
                CAC <SortIcon col="cac" />
              </th>
              <th className={thCls} style={{ width: 88 }}>Ad Spend</th>
              <th className={thClickCls} onClick={() => toggleSort("netProfit")} style={{ width: 92 }}>
                Net Profit/u <SortIcon col="netProfit" />
              </th>
              <th className={thClickCls} onClick={() => toggleSort("roas")} style={{ width: 72 }}>
                ROAS <SortIcon col="roas" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-night-800">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={12} className="px-3 py-6 text-center text-[10px] text-stone-400 dark:text-night-600">
                  No products in this category.
                </td>
              </tr>
            )}
            {filtered.map((e) => {
              const isSelected = e.productBase === selectedBase
              return (
                <tr
                  key={e.productBase}
                  onClick={() => onSelect(e.productBase)}
                  className={`cursor-pointer transition-colors ${ROW_LEFT[e.classification]} ${
                    isSelected
                      ? "bg-stone-50 dark:bg-night-850"
                      : "hover:bg-stone-50 dark:hover:bg-night-875"
                  }`}
                >
                  <td className="px-3 py-2.5">
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${BADGE_CLS[e.classification]}`}>
                      {e.classification === "BORDERLINE" ? "BDL" : e.classification.slice(0, 3)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-stone-800 dark:text-night-100 leading-tight">
                      {e.productBase}
                    </p>
                    <p className="text-[10px] text-stone-400 dark:text-night-600 truncate max-w-[240px] leading-tight mt-0.5">
                      {e.productTitle}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-stone-600 dark:text-night-300">
                    {e.totalQty.toLocaleString("en-IN")}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-stone-600 dark:text-night-300">
                    {fmtK(e.grossRevenue)}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-stone-600 dark:text-night-300">
                    {fmtCcy(e.asp)}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-stone-600 dark:text-night-300">
                    {fmtCcy(e.effectiveCogs)}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-stone-600 dark:text-night-300">
                    {e.totalCogs > 0 ? fmtK(e.totalCogs) : <span className="text-stone-400 dark:text-night-600">—</span>}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-stone-600 dark:text-night-300">
                    {fmtCcy(e.cogs)}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-stone-600 dark:text-night-300">
                    {e.cac > 0 ? fmtCcy(e.cac) : <span className="text-stone-400 dark:text-night-600">—</span>}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-stone-600 dark:text-night-300">
                    {e.adSpend > 0 ? fmtK(e.adSpend) : <span className="text-stone-400 dark:text-night-600">—</span>}
                  </td>
                  <td className={`px-3 py-2.5 tabular-nums font-semibold ${PROFIT_CLS(e.netProfit)}`}>
                    {fmtProfit(e.netProfit)}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-stone-600 dark:text-night-300">
                    {e.roas > 0 ? `${e.roas.toFixed(2)}x` : <span className="text-stone-400 dark:text-night-600">—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="border-t border-stone-100 dark:border-night-800 px-3 py-1.5 flex items-center justify-between">
        <span className="text-[10px] text-stone-400 dark:text-night-600">
          {filtered.length} of {entries.length} product{entries.length !== 1 ? "s" : ""}
        </span>
        <span className="text-[10px] text-stone-400 dark:text-night-600">
          Net Profit/u uses shared config assumptions
        </span>
      </div>
    </div>
  )
}
