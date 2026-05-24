import { analyzeColumns } from "./column-semantics"
import { deriveRowMetrics } from "./derive-metrics"
import { prettyLabel } from "./format-inr"
import type { CubeRow } from "./column-semantics"
import type { NormalizedRow } from "./types"

function shortDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso.slice(0, 10)
  return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" })
}

export function normalizeRows(rows: CubeRow[]): {
  rows: NormalizedRow[]
  profile: ReturnType<typeof analyzeColumns>
} {
  if (!rows.length) return { rows: [], profile: analyzeColumns([]) }

  const enriched = rows.map((r) => deriveRowMetrics(r))
  const profile = analyzeColumns(enriched)

  const normalized: NormalizedRow[] = enriched.map((row) => {
    const out: NormalizedRow = {}
    for (const [key, val] of Object.entries(row)) {
      if (val == null || val === "") {
        out[key] = null
        continue
      }
      if (key === profile.dateKey && typeof val === "string") {
        out[key] = val
        out[`${key}__label`] = shortDate(val)
        continue
      }
      const n = Number(val)
      out[key] = typeof val === "number" ? val : !isNaN(n) ? n : String(val)
    }
    return out
  })

  return { rows: normalized, profile }
}

export function chartData(
  rows: NormalizedRow[],
  xKey: string,
  series: { key: string; label: string }[]
): Record<string, string | number>[] {
  return rows.map((row) => {
    const labelKey = `${xKey}__label`
    const x =
      (row[labelKey] as string) ??
      (typeof row[xKey] === "string" ? shortDate(String(row[xKey])) : String(row[xKey] ?? ""))
    const point: Record<string, string | number> = { x: x || "—" }
    for (const s of series) {
      point[s.label] = Number(row[s.key] ?? 0)
    }
    return point
  })
}

export function getDisplayXKey(profile: ReturnType<typeof analyzeColumns>): string {
  if (!profile.dateKey) return profile.categoryKey ?? profile.metricKeys[0] ?? "x"
  const labelKey = `${profile.dateKey}__label`
  return labelKey
}

export { prettyLabel }
