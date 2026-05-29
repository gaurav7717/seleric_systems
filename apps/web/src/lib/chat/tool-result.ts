import type { ChartKind } from "./visualization/types"

/** Standard shape returned by chat tools — consumed by InsightCanvas */
export type ChatToolResult = {
  ok: boolean
  rows?: Record<string, unknown>[]
  type?: string
  layout?: string
  suggestedCharts?: ChartKind[]
  label?: string
  error?: string
  query?: Record<string, unknown>
  cube?: unknown
  cubes?: unknown[]
  available?: string[]
  /** clarify tool only */
  question?: string
  options?: string[]
  /** python sandbox — forces a specific chart kind */
  chartHint?: string
  /** python sandbox — named secondary result sets */
  secondary?: Record<string, unknown>
  /** python sandbox — stdout-only result */
  stdout?: string
}

export async function runTool<T>(fn: () => Promise<ChatToolResult>): Promise<ChatToolResult> {
  try {
    return await fn()
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

export function okRows(
  rows: Record<string, unknown>[],
  opts: {
    type: string
    label?: string
    layout?: string
    suggestedCharts?: ChartKind[]
    query?: Record<string, unknown>
  }
): ChatToolResult {
  return { ok: true, rows, ...opts }
}

export function fail(message: string): ChatToolResult {
  return { ok: false, error: message }
}
