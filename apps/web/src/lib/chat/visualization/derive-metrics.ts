import type { CubeRow } from "./column-semantics"

function findKey(row: CubeRow, patterns: RegExp[]): string | null {
  for (const key of Object.keys(row)) {
    if (patterns.some((p) => p.test(key))) return key
  }
  return null
}

function num(row: CubeRow, key: string | null): number {
  if (!key) return 0
  return Number(row[key] ?? 0)
}

export function deriveRowMetrics(row: CubeRow): CubeRow {
  const spendKey = findKey(row, [/ad_spend|total_ad_spend|spend/i])
  const ordersKey = findKey(row, [/total_orders|orders(?!.*rate)/i])
  const revenueKey = findKey(row, [/sales_ex|gross_revenue|revenue/i])
  const grossProfitKey = findKey(row, [/gross_profit/i])
  const aovKey = findKey(row, [/\.aov|average_order/i])

  const spend = num(row, spendKey)
  const orders = num(row, ordersKey)
  const revenue = num(row, revenueKey)
  const grossProfit = num(row, grossProfitKey)

  const out = { ...row }

  // Track which derived fields were successfully computed for diagnostics
  const missing: string[] = []

  if (!("derived.cac" in out) || out["derived.cac"] == null) {
    if (orders > 0 && spend > 0) {
      out["derived.cac"] = spend / orders
    } else if (spendKey && !ordersKey) {
      missing.push("orders (needed for CAC)")
    } else if (ordersKey && !spendKey) {
      missing.push("ad_spend (needed for CAC)")
    }
  }

  const margin = revenue > 0 ? grossProfit / revenue : null
  const aov = aovKey ? num(row, aovKey) : orders > 0 && revenue > 0 ? revenue / orders : null

  if (!("derived.ltv_estimate" in out) || out["derived.ltv_estimate"] == null) {
    if (aov != null && margin != null && margin > 0) {
      out["derived.ltv_estimate"] = aov * margin * 1.4
    } else if (!aovKey && !revenueKey) {
      missing.push("revenue/aov (needed for LTV)")
    } else if (!grossProfitKey) {
      missing.push("gross_profit (needed for LTV margin)")
    }
  }

  const cac = Number(out["derived.cac"] ?? 0)
  const ltv = Number(out["derived.ltv_estimate"] ?? 0)
  if (cac > 0 && ltv > 0) {
    out["derived.ltv_cac"] = ltv / cac
  }

  if (missing.length) {
    out["derived.__missing"] = missing.join("; ")
  }

  return out
}

export const DERIVED_FORMULA_FOOTER =
  "CAC = ad spend ÷ orders. Est. LTV = AOV (ex-GST) × gross margin % × 1.4 (estimated repeat frequency). LTV:CAC = Est. LTV ÷ CAC."
