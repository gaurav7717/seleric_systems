"use client"

import { DynamicToolUIPart } from "ai"
import { resolveToolName } from "@/lib/chat/tool-part"

const TOOL_LABELS: Record<string, string> = {
  getDailyPnl: "Daily P&L",
  getPnlTrend: "P&L Trend",
  getChannelBreakdown: "Channel Breakdown",
  runQuery: "Data Query",
  runComputedQuery: "Computed Analysis",
  exploreSchema: "Schema",
}

export function ToolResult({
  part,
  renderMode = "inline",
}: {
  part: DynamicToolUIPart
  renderMode?: "inline" | "cot"
}) {
  if (renderMode === "cot") return null

  const toolName = resolveToolName(part)
  const label = TOOL_LABELS[toolName] ?? toolName

  if (part.state === "input-streaming" || part.state === "input-available") {
    return (
      <div className="flex items-center gap-2 text-xs text-stone-400 my-2 font-sans">
        <span className="inline-block w-3 h-3 rounded-full border-2 border-stone-400 border-t-transparent animate-spin" />
        Running {label}…
      </div>
    )
  }

  if (part.state === "output-error") {
    return (
      <div className="my-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-insight-negative font-sans">
        {label}: {part.errorText ?? "Failed"}
      </div>
    )
  }

  if (toolName === "exploreSchema") {
    const result = part.output as { cube?: { name?: string } } | null
    const cubeName = result?.cube?.name ?? "schema"
    return (
      <div className="text-xs text-stone-400 my-1 italic px-1 font-sans">Schema loaded: {cubeName}</div>
    )
  }

  const result = part.output as { ok?: boolean; error?: string } | null
  if (result && !result.ok) {
    return (
      <div className="my-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-insight-negative font-sans">
        {label}: {result.error ?? "Failed"}
      </div>
    )
  }

  return null
}
