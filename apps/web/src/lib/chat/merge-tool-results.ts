import type { ChatToolResult } from "./tool-result"
import type { CubeRow } from "./visualization/column-semantics"

export type MergedToolData = {
  /** Primary time series (prefer getPnlTrend) */
  seriesRows: CubeRow[]
  pnlSeriesRows: CubeRow[]
  summaryRows: CubeRow[]
  channelRows: CubeRow[]
  hintType?: string
  /** Python sandbox chart_hint — overrides detectChartPlan auto-detection */
  chartHint?: string
  label?: string
  toolsUsed: string[]
}

const DATA_TOOLS = new Set([
  "getDailyPnl",
  "getPnlTrend",
  "getChannelBreakdown",
  "runQuery",
  "runComputedQuery",
  "mergeQueryResults",
  "runPythonAnalysis",
])

/**
 * Tools whose output is a *final compiled answer*, not a raw data fetch.
 * When any of these produced rows, intermediate runQuery / runComputedQuery
 * results are excluded from the primary series so they don't pollute the canvas.
 *
 * Priority (highest → lowest):
 *   runPythonAnalysis  — most refined: Python-compiled, flagged, derived
 *   mergeQueryResults  — cross-cube join: final merged answer
 *   runComputedQuery   — in-memory computation on fetched data
 *   runQuery           — raw fetch: intermediate when above tools are present
 */
const FINAL_TOOLS = new Set(["runPythonAnalysis", "mergeQueryResults"])
const REFINED_TOOLS = new Set(["runPythonAnalysis", "mergeQueryResults", "runComputedQuery"])

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

  // Determine which tier of tools is present so lower-tier results
  // don't override the final compiled answer.
  const hasFinalTool = dataOutputs.some((o) => FINAL_TOOLS.has(o.toolName))
  const hasRefinedTool = dataOutputs.some((o) => REFINED_TOOLS.has(o.toolName))

  let pnlSeriesRows: CubeRow[] = []
  let summaryRows: CubeRow[] = []
  let channelRows: CubeRow[] = []
  let seriesRows: CubeRow[] = []
  let hintType: string | undefined
  let chartHint: string | undefined
  let label: string | undefined
  let layoutHint: string | undefined

  for (const { toolName, result } of dataOutputs) {
    const rows = (result.rows ?? []) as CubeRow[]

    // Always take the most-refined tool's metadata (hint, label).
    // Only update when the current tool is at least as refined as what we have.
    const isRefined = REFINED_TOOLS.has(toolName)
    const isFinal = FINAL_TOOLS.has(toolName)
    if (isFinal || (isRefined && !hasFinalTool) || (!hasRefinedTool)) {
      hintType = result.type ?? hintType
      chartHint = result.chartHint ?? chartHint
      label = result.label ?? label
      layoutHint = result.layout ?? layoutHint
    }

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

      case "runPythonAnalysis":
      case "mergeQueryResults":
        // Final tools: always win — last one executed takes the canvas.
        seriesRows = rows
        break

      case "runComputedQuery":
        // Refined tool: wins over raw runQuery, loses to final tools.
        if (!hasFinalTool) {
          if (rows.length > seriesRows.length) seriesRows = rows
        }
        break

      case "runQuery":
      default:
        // Raw fetch: only contributes when no refined/final tool exists.
        if (!hasRefinedTool) {
          if (rows.length > seriesRows.length) seriesRows = rows
        }
        break
    }
  }

  // P&L trend always takes the primary series slot (it owns its canvas type).
  if (pnlSeriesRows.length) seriesRows = pnlSeriesRows

  // Last-resort fallback: nothing selected above, take the longest result.
  if (!seriesRows.length) {
    const longest = dataOutputs.reduce(
      (best, o) => ((o.result.rows?.length ?? 0) > (best.result.rows?.length ?? 0) ? o : best),
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
    hintType: layoutHint === "pnl_dashboard" ? "trend" : (chartHint ?? hintType),
    chartHint,
    label,
    toolsUsed: dataOutputs.map((o) => o.toolName),
  }
}
