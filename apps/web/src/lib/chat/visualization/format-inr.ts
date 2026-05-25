export function formatInr(value: unknown, opts?: { compact?: boolean; signed?: boolean }): string {
  if (value == null || value === "") return "—"
  const n = Number(value)
  if (!isFinite(n)) return String(value)

  const sign = opts?.signed && n < 0 ? "-" : ""
  const abs = Math.abs(n)

  if (opts?.compact !== false) {
    if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)}Cr`
    if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(2)}L`
    if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(2)}K`
  }

  if (Number.isInteger(n) || abs >= 100) {
    return `${sign}₹${abs.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
  }
  return `${sign}₹${abs.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
}

export function formatCount(value: unknown): string {
  if (value == null) return "—"
  const n = Number(value)
  if (!isFinite(n)) return String(value)
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(2)}K`
  return n.toLocaleString("en-IN", { maximumFractionDigits: 0 })
}

export function formatPercent(value: unknown, decimals = 1): string {
  if (value == null) return "—"
  const n = Number(value)
  if (!isFinite(n)) return String(value)
  return `${n.toFixed(decimals)}%`
}

export function formatRatio(value: unknown): string {
  if (value == null) return "—"
  const n = Number(value)
  if (!isFinite(n)) return String(value)
  return `${n.toFixed(2)}x`
}

export function formatAxisInr(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1_00_000) return `₹${(v / 1_00_000).toFixed(0)}L`
  if (abs >= 1_000) return `₹${(v / 1_000).toFixed(0)}K`
  return `₹${v.toFixed(0)}`
}

export function prettyLabel(key: string): string {
  return key
    .replace(/^derived\./, "")
    .replace(/^[^.]+\./, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
