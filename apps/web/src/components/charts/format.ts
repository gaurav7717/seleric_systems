export function fmtCurrency(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1_00_000) return `₹${(v / 1_00_000).toFixed(1)}L`
  if (abs >= 1_000) return `₹${(v / 1_000).toFixed(1)}K`
  return `₹${v.toFixed(0)}`
}

export function fmtCount(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}K`
  return `${v.toFixed(0)}`
}

export function fmtPct(v: number): string {
  return `${v.toFixed(1)}%`
}

export function shortDate(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { month: "short", day: "numeric" })
}

export function prettyLabel(key: string): string {
  return key
    .replace(/^[^.]+\./, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function isCountMetric(key: string): boolean {
  return /orders?|count|qty|quantity|units?|clicks?|impressions?|views?|engagements?/i.test(key)
}

export function isPctMetric(key: string): boolean {
  return /pct|rate|margin|ctr|roas/i.test(key)
}

export function detectDateKey(rows: Record<string, unknown>[]): string | null {
  if (!rows.length) return null
  const keys = Object.keys(rows[0])
  return (
    keys.find((k) => /report_date|created_at|date_start|date_stop/i.test(k)) ?? null
  )
}

export function detectNumericKeys(rows: Record<string, unknown>[], exclude?: string[]): string[] {
  if (!rows.length) return []
  const ex = new Set(exclude ?? [])
  return Object.keys(rows[0]).filter((k) => {
    if (ex.has(k)) return false
    if (/\.id$|_id$|surrogate/i.test(k)) return false
    const v = rows[0][k]
    return typeof v === "number" || (typeof v === "string" && !isNaN(Number(v)) && String(v).trim() !== "")
  })
}

export const CHART_COLORS = ["#34d399", "#f97316", "#a78bfa", "#60a5fa", "#fb7185", "#fbbf24", "#2dd4bf"]
