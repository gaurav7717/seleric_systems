export type CubeRow = Record<string, unknown>

export function extractRows(raw: unknown): CubeRow[] {
  if (Array.isArray(raw)) return raw as CubeRow[]
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>
    if (Array.isArray(obj.data)) return obj.data as CubeRow[]
    // Single aggregate row — any key containing a dot (cube.measure format) is a valid data row.
    // Excludes error objects which have plain keys like "error", "message", "status".
    if (Object.keys(obj).some((k) => k.includes("."))) {
      return [obj as CubeRow]
    }
  }
  return []
}

/** Match Cube row keys when the model passes shorthand dim names. */
export function resolveRowKey(row: CubeRow, dim: string): string | null {
  if (dim in row && row[dim] != null && row[dim] !== "") return dim
  const suffix = dim.includes(".") ? (dim.split(".").pop() ?? dim) : dim
  for (const key of Object.keys(row)) {
    if (key === dim || key === suffix || key.endsWith(`.${suffix}`)) {
      if (row[key] != null && row[key] !== "") return key
    }
  }
  return null
}

export function rowDimValue(row: CubeRow, dim: string): string {
  const key = resolveRowKey(row, dim)
  return key ? String(row[key]) : ""
}

export function detectChartType(query: Record<string, unknown>, rows: CubeRow[]): string {
  if (!rows.length) return "table"
  const timeDims = (query.timeDimensions as { granularity?: string }[] | undefined) ?? []
  if (timeDims.some((td) => td.granularity)) return "trend"
  const keys = Object.keys(rows[0] ?? {})
  const hasChannel = keys.some((k) => /platform|channel|source/i.test(k))
  if (hasChannel && rows.length <= 20) return "channel"
  if (rows.length <= 3) return "kpi"
  return "table"
}
