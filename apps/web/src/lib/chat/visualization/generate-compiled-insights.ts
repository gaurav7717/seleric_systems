import { aggregatePeriod } from "./aggregate"
import { analyzeColumns, type CubeRow } from "./column-semantics"
import { deriveRowMetrics } from "./derive-metrics"
import { formatInr, formatRatio, prettyLabel } from "./format-inr"
import type { MergedToolData } from "../merge-tool-results"

export type InsightSection = {
  title: string
  bullets: string[]
}

function findKey(row: CubeRow, patterns: RegExp[]): string | null {
  const keys = Object.keys(row)
  for (const p of patterns) {
    const k = keys.find((key) => p.test(key))
    if (k) return k
  }
  return null
}

function num(row: CubeRow, key: string | null): number {
  if (!key) return 0
  return Number(row[key] ?? 0)
}

function sortByDate(rows: CubeRow[], dateKey: string): CubeRow[] {
  return [...rows].sort((a, b) => String(a[dateKey] ?? "").localeCompare(String(b[dateKey] ?? "")))
}

function monthLabel(dateVal: string): string {
  const d = new Date(dateVal)
  return isNaN(d.getTime())
    ? dateVal.slice(0, 7)
    : d.toLocaleDateString("en-IN", { month: "short", year: "numeric" })
}

export function generateCompiledInsights(merged: MergedToolData): InsightSection[] {
  const sections: InsightSection[] = []
  const series = merged.pnlSeriesRows.length ? merged.pnlSeriesRows : merged.seriesRows
  const enriched = series.map(deriveRowMetrics)
  const profile = analyzeColumns(enriched)

  const summary = aggregatePeriod(
    merged.summaryRows.length ? merged.summaryRows : enriched
  )

  const revenueKey = findKey(summary, [/sales_ex|gross_revenue|revenue/i])
  const spendKey = findKey(summary, [/ad_spend|total_ad_spend/i])
  const profitKey = findKey(summary, [/net_profit/i])
  const ordersKey = findKey(summary, [/total_orders/i])

  const totalRevenue = num(summary, revenueKey)
  const totalSpend = num(summary, spendKey)
  const totalProfit = num(summary, profitKey)
  const totalOrders = num(summary, ordersKey)
  const avgCac = Number(summary["derived.cac"] ?? 0)
  const avgLtv = Number(summary["derived.ltv_estimate"] ?? 0)
  const ltvCac = Number(summary["derived.ltv_cac"] ?? 0)

  const headline: string[] = []
  if (totalRevenue) headline.push(`Period revenue (ex-GST) **${formatInr(totalRevenue)}**`)
  if (totalSpend) headline.push(`ad spend **${formatInr(totalSpend)}**`)
  if (totalProfit) {
    headline.push(
      `net profit **${formatInr(totalProfit, { signed: true })}**`
    )
  }
  if (totalOrders) headline.push(`**${totalOrders.toLocaleString("en-IN")}** orders`)
  if (headline.length) {
    sections.push({
      title: "Key numbers",
      bullets: [`Across the compiled period: ${headline.join(", ")}.`],
    })
  }

  if (profile.dateKey && enriched.length >= 2) {
    const dateKey = profile.dateKey
    const sorted = sortByDate(enriched, dateKey)
    const revK = revenueKey ?? findKey(sorted[0], [/sales_ex|revenue/i])
    const profitK = profitKey ?? findKey(sorted[0], [/net_profit/i])

    const trendBullets: string[] = []

    if (revK && sorted.length >= 2) {
      const first = num(sorted[0], revK)
      const last = num(sorted[sorted.length - 1], revK)
      if (first > 0) {
        const chg = ((last - first) / first) * 100
        trendBullets.push(
          `Revenue moved from **${formatInr(first)}** (${monthLabel(String(sorted[0][dateKey]))}) to **${formatInr(last)}** (${monthLabel(String(sorted[sorted.length - 1][dateKey]))}) — **${chg >= 0 ? "+" : ""}${chg.toFixed(0)}%** over the window.`
        )
      }
    }

    if (profitK) {
      let best = sorted[0]
      let worst = sorted[0]
      for (const row of sorted) {
        if (num(row, profitK) > num(best, profitK)) best = row
        if (num(row, profitK) < num(worst, profitK)) worst = row
      }
      trendBullets.push(
        `Best month (net): **${monthLabel(String(best[dateKey]))}** at **${formatInr(num(best, profitK), { signed: true })}**; weakest: **${monthLabel(String(worst[dateKey]))}** at **${formatInr(num(worst, profitK), { signed: true })}**.`
      )
    }

    if (trendBullets.length) {
      sections.push({ title: "Trend", bullets: trendBullets })
    }
  }

  const cacBullets: string[] = []
  if (avgCac > 0) cacBullets.push(`Blended **CAC ≈ ${formatInr(avgCac)}** (ad spend ÷ orders).`)
  if (avgLtv > 0) {
    cacBullets.push(
      `**Est. LTV ≈ ${formatInr(avgLtv)}** — proxy from AOV × margin × 1.4; not cohort-based repeat revenue.`
    )
  }
  if (ltvCac > 0) {
    const health = ltvCac >= 3 ? "healthy" : ltvCac >= 1 ? "below ideal (target >3×)" : "underwater"
    cacBullets.push(`Period **LTV:CAC = ${formatRatio(ltvCac)}** (${health}).`)
  }

  if (profile.dateKey && enriched.length) {
    const dateKey = profile.dateKey
    const sorted = sortByDate(enriched, dateKey)
    let firstCross: string | null = null
    for (const row of sorted) {
      const ratio = Number(row["derived.ltv_cac"] ?? 0)
      if (ratio >= 1 && !firstCross) {
        firstCross = monthLabel(String(row[dateKey]))
      }
    }
    if (firstCross) {
      cacBullets.push(`**LTV:CAC first reached ≥1× in ${firstCross}.**`)
    } else if (sorted.some((r) => Number(r["derived.ltv_cac"] ?? 0) > 0)) {
      cacBullets.push(`LTV:CAC stayed **below 1×** for every month in this period.`)
    }
  }

  if (cacBullets.length) {
    sections.push({ title: "CAC / LTV", bullets: cacBullets })
  }

  if (merged.channelRows.length) {
    const chRows = merged.channelRows
    const revK =
      findKey(chRows[0], [/revenue/i]) ?? (chRows[0].revenue != null ? "revenue" : null)
    const profitK =
      findKey(chRows[0], [/net_profit|netProfit/i]) ??
      (chRows[0].netProfit != null ? "netProfit" : null)
    const channelK = chRows[0].channel != null ? "channel" : findKey(chRows[0], [/channel|platform/i])

    if (channelK && revK) {
      const ranked = [...chRows].sort((a, b) => num(b, revK) - num(a, revK))
      const top = ranked[0]
      const chBullets = ranked.slice(0, 3).map((r) => {
        const name = String(r[channelK] ?? "—")
        const rev = formatInr(num(r, revK))
        const profit = profitK ? `, net **${formatInr(num(r, profitK), { signed: true })}**` : ""
        return `**${name}**: revenue **${rev}**${profit}`
      })
      sections.push({
        title: "Channel split",
        bullets: [
          `Top channel by revenue: **${String(top[channelK])}**.`,
          ...chBullets,
        ],
      })
    }
  }

  const takeaway: string[] = []
  if (ltvCac > 0 && ltvCac < 1) {
    takeaway.push("Unit economics are tight: estimated LTV does not cover CAC on average — focus on repeat rate or spend efficiency.")
  } else if (ltvCac >= 1 && ltvCac < 3) {
    takeaway.push("LTV exceeds CAC but ratio is below a healthy 3× — growth may be spend-constrained.")
  }
  if (totalProfit < 0) {
    takeaway.push("Period net profit is negative — review ad spend vs gross margin by month.")
  } else if (totalProfit > 0) {
    takeaway.push("Period is net profitable on compiled P&L — double-check which months drive the bulk of profit.")
  }

  if (takeaway.length) {
    sections.push({ title: "Takeaway", bullets: takeaway })
  }

  return sections
}

export function pickTableColumns(rows: CubeRow[]): string[] {
  if (!rows.length) return []
  const all = Object.keys(rows[0]).filter((k) => !k.endsWith("__label") && !/surrogate|\.id$/i.test(k))
  const priority = (k: string) => {
    if (/report_date|\.month|created_at/i.test(k)) return 0
    if (/sales_ex|total_sales/i.test(k)) return 1
    if (/gross_profit/i.test(k)) return 2
    if (/ad_spend/i.test(k)) return 3
    if (/net_profit/i.test(k)) return 4
    if (/total_orders|orders/i.test(k)) return 5
    if (/derived\.(cac|ltv)/i.test(k)) return 6
    if (/revenue/i.test(k)) return 8
    return 7
  }
  const sorted = [...all].sort((a, b) => priority(a) - priority(b))
  const seen = new Set<string>()
  const out: string[] = []
  let hasDate = false
  for (const k of sorted) {
    // Keep only the first (most granular) date column per result set
    const isDate = /report_date|\.month$|\.week$|\.day$|\.year$|created_at|date_start|date_stop/i.test(k)
    if (isDate) {
      if (hasDate) continue
      hasDate = true
    }
    const role = /revenue|sales/i.test(k) ? "rev" : k
    if (/revenue|sales/i.test(k) && [...seen].some((s) => /rev/.test(s))) continue
    seen.add(role)
    out.push(k)
    if (out.length >= 11) break
  }
  return out.length ? out : all.slice(0, 11)
}
