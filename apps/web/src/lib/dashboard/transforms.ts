import { rowDimValue, type CubeRow } from "@/lib/chat/cube-rows"

export interface NamedValue {
  name: string
  value: number
}

/** Turn a single wide Cube row into labeled slices (e.g. channel revenue donut). */
export function wideRowToSlices(
  row: CubeRow,
  slices: { label: string; measure: string }[]
): NamedValue[] {
  return slices.map(({ label, measure }) => ({
    name: label,
    value: Number(row[measure] ?? 0),
  }))
}

export function sortByDate(rows: CubeRow[], dim: string): CubeRow[] {
  return [...rows].sort((a, b) => {
    const av = rowDimValue(a, dim)
    const bv = rowDimValue(b, dim)
    return av < bv ? -1 : av > bv ? 1 : 0
  })
}

export function topN(rows: CubeRow[], n: number, measureKey: string): CubeRow[] {
  return [...rows]
    .sort((a, b) => Number(b[measureKey] ?? 0) - Number(a[measureKey] ?? 0))
    .slice(0, n)
}
