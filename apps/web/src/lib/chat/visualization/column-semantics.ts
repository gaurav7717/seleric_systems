import type { ColumnInfo, ColumnRole, DataProfile, MetricRole } from "./types"

export type CubeRow = Record<string, unknown>

function inferMetricRole(key: string): MetricRole {
  const k = key.toLowerCase()
  if (/revenue|sales_ex|gross_revenue/i.test(k)) return "revenue"
  if (/ad_spend|spend|cost(?!.*profit)/i.test(k) && !/cogs/i.test(k)) return "spend"
  if (/net_profit|gross_profit|profit/i.test(k)) return "profit"
  if (/cogs/i.test(k)) return "cost"
  if (/orders?|count|qty/i.test(k)) return "orders"
  if (/cac/i.test(k)) return "cac"
  if (/ltv/i.test(k)) return "ltv"
  return "generic"
}

function inferColumnRole(key: string, sample: unknown): ColumnRole {
  const k = key.toLowerCase()
  if (/\.id$|_id$|surrogate|uuid/i.test(k)) return "id"
  if (/report_date|created_at|date_start|date_stop|\.day$|\.week$|\.month$|period/i.test(k)) {
    if (typeof sample === "string" && (sample.includes("T") || /^\d{4}-\d{2}/.test(sample))) return "date"
    if (typeof sample === "string") return "date"
  }
  if (/platform|channel|source|category|title|name|product|campaign/i.test(k) && typeof sample === "string") {
    return "category"
  }
  if (/ltv.?cac|roas|ctr|cvr|margin|rate|pct|percent/i.test(k)) return "rate"
  if (/ratio/i.test(k)) return "ratio"
  if (/impressions|clicks|views|sessions/i.test(k)) return "count"

  const n = Number(sample)
  if (typeof sample === "number" || (typeof sample === "string" && sample.trim() !== "" && !isNaN(n))) {
    if (/net_profit|delta|change/i.test(k)) return "signed"
    if (/orders?|count|qty|units/i.test(k)) return "count"
    if (/revenue|spend|profit|cogs|cost|cac|ltv|aov|amount/i.test(k)) return "currency"
    return "metric"
  }

  if (typeof sample === "string" && sample.length > 0 && sample.length < 80) return "category"
  return "unknown"
}

export function analyzeColumns(rows: CubeRow[]): DataProfile {
  if (!rows.length) {
    return { columns: [], dateKey: null, categoryKey: null, metricKeys: [], rowCount: 0 }
  }

  const keys = Object.keys(rows[0])
  const columns: ColumnInfo[] = keys.map((key) => {
    const sample = rows.find((r) => r[key] != null && r[key] !== "")?.[key]
    const role = inferColumnRole(key, sample)
    const metricRole = ["currency", "metric", "count", "rate", "signed"].includes(role)
      ? inferMetricRole(key)
      : undefined
    return { key, role, metricRole }
  })

  const dateKey = columns.find((c) => c.role === "date")?.key ?? null
  let categoryKey =
    columns.find((c) => c.role === "category" && c.key !== dateKey)?.key ??
    (rows[0].channel != null ? "channel" : null)

  if (!categoryKey) {
    const cat = columns.find((c) => c.role === "category")
    categoryKey = cat?.key ?? null
  }

  const metricKeys = columns
    .filter((c) => ["currency", "metric", "count", "rate", "signed", "ratio"].includes(c.role))
    .map((c) => c.key)

  return { columns, dateKey, categoryKey, metricKeys, rowCount: rows.length }
}

export function isPnlShape(profile: DataProfile): boolean {
  const roles = profile.columns.map((c) => c.metricRole).filter(Boolean)
  const hasRevenue = roles.includes("revenue")
  const hasSpend = roles.includes("spend")
  const hasProfit = roles.includes("profit")
  return Boolean(profile.dateKey && hasRevenue && (hasSpend || hasProfit))
}

export function hasFunnelColumns(keys: string[]): boolean {
  const lower = keys.map((k) => k.toLowerCase())
  const stages = ["impression", "click", "view", "add_to_cart", "checkout", "purchase", "order"]
  const hits = stages.filter((s) => lower.some((k) => k.includes(s)))
  return hits.length >= 3
}

export function getSeriesColor(role?: MetricRole, index = 0): string {
  const palette = ["#4A90D9", "#B8860B", "#2A9D8F", "#C62828", "#7B68EE", "#E07B54"]
  switch (role) {
    case "revenue":
      return "#4A90D9"
    case "spend":
      return "#B8860B"
    case "profit":
      return "#2A9D8F"
    case "cost":
      return "#E07B54"
    case "cac":
      return "#4A90D9"
    case "ltv":
      return "#B8860B"
    default:
      return palette[index % palette.length]
  }
}

export function valueColor(key: string, value: number): string {
  const role = inferMetricRole(key)
  if (role === "profit" || /net_profit/i.test(key)) {
    return value >= 0 ? "text-insight-positive" : "text-insight-negative"
  }
  if (role === "spend" || role === "cac") return "text-insight-cost"
  if (/ltv.?cac/i.test(key)) {
    return value < 1 ? "text-orange-600" : "text-insight-cost font-semibold"
  }
  return "text-stone-900"
}
