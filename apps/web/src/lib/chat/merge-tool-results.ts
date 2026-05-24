import type { ChatToolResult } from "./tool-result"
import type { CubeRow } from "./visualization/column-semantics"

export type MergedToolData = {
  /** Primary time series (prefer getPnlTrend) */
  seriesRows: CubeRow[]
  pnlSeriesRows: CubeRow[]
  summaryRows: CubeRow[]
  channelRows: CubeRow[]
  hintType?: string
  label?: string
  toolsUsed: string[]
}

const DATA_TOOLS = new Set([
  "getDailyPnl",
  "getPnlTrend",
  "getChannelBreakdown",
  "runQuery",
  "runComputedQuery",
])

export function isDataTool(name: string): boolean {
  return DATA_TOOLS.has(name)
}

export function mergeToolOutputs(
  outputs: Array<{ toolName: string; result: ChatToolResult }>
): MergedToolData | null {
  const dataOutputs = outputs.filter(
    (o) => isDataTool(o.toolName) && o.result.ok && (o.result.rows?.length ?? 0) > 0
  )
  if (!dataOutputs.length) return null

  let pnlSeriesRows: CubeRow[] = []
  let summaryRows: CubeRow[] = []
  let channelRows: CubeRow[] = []
  let seriesRows: CubeRow[] = []
  let hintType: string | undefined
  let label: string | undefined
  let layoutHint: string | undefined

  for (const { toolName, result } of dataOutputs) {
    const rows = (result.rows ?? []) as CubeRow[]
    hintType = result.type ?? hintType
    label = result.label ?? label
    layoutHint = result.layout ?? layoutHint

    switch (toolName) {
      case "getPnlTrend":
        pnlSeriesRows = rows
        break
      case "getDailyPnl":
        if (rows.length <= 2) summaryRows = rows
        else if (rows.length > seriesRows.length) seriesRows = rows
        break
      case "getChannelBreakdown":
        channelRows = rows
        break
      default:
        if (rows.length > seriesRows.length) seriesRows = rows
        break
    }
  }

  if (pnlSeriesRows.length) seriesRows = pnlSeriesRows
  else if (!seriesRows.length) {
    const longest = dataOutputs.reduce(
      (best, o) => {
        const len = (o.result.rows?.length ?? 0)
        return len > (best.result.rows?.length ?? 0) ? o : best
      },
      dataOutputs[0]
    )
    seriesRows = (longest.result.rows ?? []) as CubeRow[]
  }

  if (!summaryRows.length && seriesRows.length === 1) {
    summaryRows = seriesRows
  }

  return {
    seriesRows,
    pnlSeriesRows,
    summaryRows,
    channelRows,
    hintType: layoutHint === "pnl_dashboard" ? "trend" : hintType,
    label,
    toolsUsed: dataOutputs.map((o) => o.toolName),
  }
}
