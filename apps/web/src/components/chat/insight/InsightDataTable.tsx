"use client"

import {
  formatInr,
  formatCount,
  formatRatio,
  prettyLabel,
  valueColor,
} from "@/lib/chat/visualization"
import type { NormalizedRow } from "@/lib/chat/visualization"
import { aggregatePeriod } from "@/lib/chat/visualization/aggregate"
import { pickTableColumns } from "@/lib/chat/visualization/generate-compiled-insights"
import type { CubeRow } from "@/lib/chat/visualization/column-semantics"

function formatCell(key: string, val: unknown): string {
  if (val == null) return "—"
  if (/ltv.?cac|roas/i.test(key)) return formatRatio(val)
  // CTR and CVR are stored as decimals (0.177 = 17.7%)
  if (/\bctr\b|cvr/i.test(key)) return `${(Number(val) * 100).toFixed(2)}%`
  if (/orders?|count/i.test(key)) return formatCount(val)
  if (/pct|margin|rate/i.test(key)) return `${Number(val).toFixed(1)}%`
  const n = Number(val)
  if (!isNaN(n) && /revenue|spend|profit|cogs|cac|ltv|cost|aov|amount|cpc|cpm/i.test(key)) {
    return formatInr(n, { signed: /profit|net/i.test(key) })
  }
  if (!isNaN(n)) return n.toLocaleString("en-IN", { maximumFractionDigits: 2 })
  if (typeof val === "string" && val.includes("T")) return val.slice(0, 10)
  return String(val)
}

const MAX_VISIBLE_ROWS = 30

export function InsightDataTable({
  rows,
  title,
  showSummary = true,
}: {
  rows: NormalizedRow[] | CubeRow[]
  title?: string
  showSummary?: boolean
}) {
  if (!rows.length) return null

  const picked = pickTableColumns(rows as CubeRow[])
  const headers = (
    picked.length
      ? picked
      : Object.keys(rows[0]).filter(
          (k) => !k.endsWith("__label") && !/surrogate|\.id$|__missing$/i.test(k)
        )
  )

  const totalRows = rows.length
  const visibleRows = (rows as NormalizedRow[]).slice(0, MAX_VISIBLE_ROWS)
  const truncated = totalRows > MAX_VISIBLE_ROWS
  const summary = showSummary ? aggregatePeriod(rows as CubeRow[]) : null

  return (
    <div className="my-3">
      {title && (
        <h4 className="text-[10px] font-semibold uppercase tracking-widest text-stone-500 dark:text-night-400 mb-2 font-sans">
          {title}
        </h4>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm font-serif border-collapse [&_tbody_tr:nth-child(even)]:bg-stone-50/80 dark:[&_tbody_tr:nth-child(even)]:!bg-night-850/50">
          <thead>
            <tr className="border-b border-stone-200 dark:border-night-800">
              {headers.map((h) => (
                <th
                  key={h}
                  className="py-2 px-2 text-left text-[10px] font-semibold uppercase tracking-wide text-stone-500 dark:text-night-400 font-sans whitespace-nowrap"
                >
                  {prettyLabel(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, i) => (
              <tr key={i} className="border-b border-stone-100 dark:border-night-800/50">
                {headers.map((h) => {
                  const val = row[h]
                  const rawVal = val as unknown
                  const n = Number(val)
                  const isBool = rawVal === true || rawVal === false || val === "true" || val === "false"
                  const boolVal = rawVal === true || val === "true"
                  const colorClass = isBool
                    ? boolVal ? "text-insight-negative font-medium" : "text-insight-positive font-medium"
                    : !isNaN(n) && typeof val === "number"
                      ? valueColor(h, n)
                      : "text-stone-800 dark:text-night-200"
                  return (
                    <td
                      key={h}
                      className={`py-2 px-2 text-left whitespace-nowrap ${colorClass}`}
                    >
                      {isBool ? (boolVal ? "⚑ Flag" : "✓") : formatCell(h, val)}
                    </td>
                  )
                })}
              </tr>
            ))}
            {summary && (
              <tr className="border-t-2 border-stone-300 dark:border-night-700 bg-stone-100/60 dark:bg-night-850 font-semibold">
                {headers.map((h, i) => (
                  <td key={h} className="py-2 px-2 text-left text-stone-900 dark:text-night-50">
                    {i === 0 ? "Total / avg" : summary[h] != null ? formatCell(h, summary[h]) : "—"}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {truncated && (
        <p className="mt-1.5 text-[11px] text-stone-400 dark:text-night-500 font-sans">
          Showing top {MAX_VISIBLE_ROWS} of {totalRows} rows — ask for a specific filter or ranking to see more.
        </p>
      )}
    </div>
  )
}
