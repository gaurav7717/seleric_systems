import { callCubeTool } from "@/lib/cube-client"
import { extractRows, resolveRowKey, rowDimValue, type CubeRow } from "./cube-rows"
import { IST_TIMEZONE } from "./pnl"
import type { ComputedSpec } from "./schemas"

export async function runComputedAnalysis(
  fetchQuery: Record<string, unknown>,
  compute: ComputedSpec
): Promise<CubeRow[]> {
  const raw = await callCubeTool("cube_query", {
    query: { limit: 100_000, ...fetchQuery, timezone: IST_TIMEZONE },
  })
  const rows = extractRows(raw)

  switch (compute.type) {
    case "pair_count":
      return pairCount(rows, compute.groupByDim, compute.pairDim)
    case "group_by":
      return groupBySum(rows, compute.groupKeys)
    case "top_n":
      return topN(rows, compute.rankBy, compute.n ?? 20)
    case "raw":
      return rows
    case "formula":
      return applyFormula(rows, compute.outputColumn, compute.numerator, compute.denominator, compute.scale ?? 1)
  }
}

function pairCount(rows: CubeRow[], groupByDim: string, pairDim: string): CubeRow[] {
  const groups = new Map<string, string[]>()
  for (const row of rows) {
    const groupVal = rowDimValue(row, groupByDim)
    const pairVal = rowDimValue(row, pairDim)
    if (!groupVal || !pairVal) continue
    if (!groups.has(groupVal)) groups.set(groupVal, [])
    groups.get(groupVal)!.push(pairVal)
  }

  const pairCounts = new Map<string, number>()
  for (const items of groups.values()) {
    const unique = [...new Set(items)].sort()
    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        const key = `${unique[i]} ↔ ${unique[j]}`
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1)
      }
    }
  }

  return [...pairCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([pair, co_purchases]) => ({ pair, co_purchases }))
}

function groupBySum(rows: CubeRow[], groupKeys: string[]): CubeRow[] {
  const groups = new Map<string, CubeRow>()
  for (const row of rows) {
    const key = groupKeys.map((k) => rowDimValue(row, k)).join("|")
    if (!groups.has(key)) {
      const g: CubeRow = {}
      for (const k of groupKeys) {
        const resolved = resolveRowKey(row, k)
        g[k] = resolved ? row[resolved] : row[k]
      }
      groups.set(key, g)
    }
    const g = groups.get(key)!
    const resolvedGroupKeys = new Set(
      groupKeys.flatMap((k) => {
        const resolved = resolveRowKey(row, k)
        return resolved ? [k, resolved] : [k]
      })
    )
    for (const [k, v] of Object.entries(row)) {
      if (resolvedGroupKeys.has(k)) continue
      const n = Number(v)
      if (!isNaN(n)) g[k] = (Number(g[k] ?? 0)) + n
    }
  }
  return [...groups.values()]
}

function applyFormula(
  rows: CubeRow[],
  outputCol: string,
  numCol: string,
  denCol: string,
  scale: number
): CubeRow[] {
  return rows.map((row) => {
    const numKey = resolveRowKey(row, numCol) ?? numCol
    const denKey = resolveRowKey(row, denCol) ?? denCol
    const num = Number(row[numKey] ?? 0)
    const den = Number(row[denKey] ?? 0)
    return { ...row, [outputCol]: den !== 0 ? (num / den) * scale : null }
  })
}

function topN(rows: CubeRow[], rankBy: string, n: number): CubeRow[] {
  return [...rows]
    .sort((a, b) => {
      const aKey = resolveRowKey(a, rankBy) ?? rankBy
      const bKey = resolveRowKey(b, rankBy) ?? rankBy
      return Number(b[bKey] ?? 0) - Number(a[aKey] ?? 0)
    })
    .slice(0, n)
}
