"use client"

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  trend?: number
  invert?: boolean
}

function KpiCard({ label, value, sub, trend, invert }: KpiCardProps) {
  const trendPositive = invert ? (trend ?? 0) < 0 : (trend ?? 0) > 0
  const trendColor = trend === undefined ? "" : trendPositive ? "text-emerald-400" : "text-red-400"
  const trendSign = (trend ?? 0) > 0 ? "+" : ""
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 flex flex-col gap-1 min-w-[130px]">
      <span className="text-xs text-slate-500 uppercase tracking-wide">{label}</span>
      <span className="text-lg font-semibold text-slate-100">{value}</span>
      {sub && <span className="text-xs text-slate-400">{sub}</span>}
      {trend !== undefined && (
        <span className={`text-xs font-medium ${trendColor}`}>
          {trendSign}{trend.toFixed(1)}% vs prev
        </span>
      )}
    </div>
  )
}

function fmtNum(v: unknown, key: string): string {
  if (v == null || v === "") return "—"
  const n = Number(v)
  if (isNaN(n)) return String(v)
  if (/order|count|qty|units/i.test(key)) return n.toLocaleString("en-IN", { maximumFractionDigits: 0 })
  if (/pct|rate|roas|ctr|cvr/i.test(key)) return n.toFixed(2)
  const abs = Math.abs(n)
  if (abs >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)}L`
  if (abs >= 1_000) return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
  return `₹${n.toFixed(2)}`
}

function pct(curr: unknown, prev: unknown): number | undefined {
  const c = Number(curr), p = Number(prev)
  if (!isFinite(c) || !isFinite(p) || p === 0) return undefined
  return ((c - p) / Math.abs(p)) * 100
}

function prettyLabel(key: string): string {
  return key.replace(/^[^.]+\./, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function isDateKey(k: string) {
  return /report_date|created_at|date_start|date_stop|date\b|period/i.test(k)
}

function isMetricKey(k: string, val: unknown) {
  if (isDateKey(k)) return false
  if (/\.id$|_id$|surrogate|key/i.test(k)) return false
  return typeof val === "number" || (typeof val === "string" && !isNaN(Number(val)) && String(val).trim() !== "")
}

interface Props {
  rows: Record<string, unknown>[]
  type?: string
}

export function KpiCards({ rows, type }: Props) {
  if (!rows?.length) return <p className="text-sm text-slate-500">No data returned.</p>

  const keys = Object.keys(rows[0]).filter((k) => isMetricKey(k, rows[0][k]))

  // Two rows: show current vs previous comparison
  if (rows.length === 2 || type === "today_vs_yesterday") {
    const sorted = [...rows].sort((a, b) => {
      const dateKey = Object.keys(a).find(isDateKey) ?? ""
      const av = String(a[dateKey] ?? ""), bv = String(b[dateKey] ?? "")
      return bv > av ? 1 : -1
    })
    const curr = sorted[0], prev = sorted[1]
    const dateKey = Object.keys(curr).find(isDateKey)
    const prevDate = dateKey ? String(prev[dateKey] ?? "").slice(0, 10) : "prev"

    return (
      <div className="flex flex-wrap gap-3 my-2">
        {keys.slice(0, 6).map((k) => (
          <KpiCard
            key={k}
            label={prettyLabel(k)}
            value={fmtNum(curr[k], k)}
            sub={`${prevDate}: ${fmtNum(prev[k], k)}`}
            trend={pct(curr[k], prev[k])}
            invert={/spend|cost|cogs/i.test(k)}
          />
        ))}
      </div>
    )
  }

  // Single row: show flat KPI cards
  const row = rows[0]
  return (
    <div className="flex flex-wrap gap-3 my-2">
      {keys.slice(0, 8).map((k) => (
        <KpiCard key={k} label={prettyLabel(k)} value={fmtNum(row[k], k)} />
      ))}
    </div>
  )
}
