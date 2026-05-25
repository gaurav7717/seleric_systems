import { isTextUIPart, isToolUIPart, type UIMessage } from "ai"
import type { ChatToolResult } from "./tool-result"
import { isDataTool, mergeToolOutputs } from "./merge-tool-results"
import { isToolFinished, isToolRunning, resolveToolName } from "./tool-part"

export type CotStep = {
  id: string
  toolName: string
  label: string
  detail: string
  narration: string
  state: "running" | "done" | "error"
  errorText?: string
}

const TOOL_LABELS: Record<string, string> = {
  getDailyPnl: "Daily P&L",
  getPnlTrend: "Cube daily pnl",
  getChannelBreakdown: "Channel breakdown",
  runQuery: "Cube query",
  runComputedQuery: "Computed analysis",
  mergeQueryResults: "Cross-cube join",
  clarify: "Clarifying question",
  exploreSchema: "Schema",
}

function toolLabel(name: string | undefined): string {
  if (!name) return "Working"
  return TOOL_LABELS[name] ?? name.replace(/([A-Z])/g, " $1").trim()
}

function toolDetail(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case "getDailyPnl":
      return `${input.startDate}${input.endDate && input.endDate !== input.startDate ? ` → ${input.endDate}` : ""}`
    case "getPnlTrend":
      return `${input.startDate} → ${input.endDate} (${input.granularity ?? "month"})`
    case "getChannelBreakdown":
      return `${input.startDate}`
    case "runQuery":
      return (input.label as string) ?? "custom query"
    case "runComputedQuery":
      return (input.label as string) ?? ((input.compute as Record<string, unknown>)?.type as string) ?? "computed"
    case "mergeQueryResults":
      return (input.label as string) ?? `join on ${String(input.joinKey ?? "key")}`
    case "clarify":
      return ""
    case "exploreSchema":
      return (input.cubeName as string) ?? "all cubes"
    default:
      return ""
  }
}

function isCoTNarration(text: string, hasFollowingTool: boolean): boolean {
  if (!hasFollowingTool) return false
  const t = text.trim()
  if (!t.length || t.length > 320) return false
  if (/^#+\s/m.test(t)) return false
  if (/\n\n/.test(t)) return false
  if ((t.match(/\*\*/g) ?? []).length >= 2) return false
  const sentences = t.split(/[.!?]+/).filter((s) => s.trim().length > 3)
  return sentences.length <= 2
}

export type ClarifyPrompt = {
  question: string
  options?: string[]
}

export type PartitionedAssistantMessage = {
  cotSteps: CotStep[]
  narrativeParts: string[]
  mergedData: ReturnType<typeof mergeToolOutputs>
  hasToolActivity: boolean
  clarifyPrompt: ClarifyPrompt | null
}

export function partitionAssistantMessage(msg: UIMessage): PartitionedAssistantMessage {
  const cotSteps: CotStep[] = []
  const narrativeParts: string[] = []
  const toolOutputs: Array<{ toolName: string; result: ChatToolResult }> = []
  let clarifyPrompt: ClarifyPrompt | null = null

  let pendingNarration = ""

  for (let i = 0; i < msg.parts.length; i++) {
    const part = msg.parts[i]

    if (isTextUIPart(part)) {
      const text = part.text?.trim() ?? ""
      if (!text) continue

      // A tool has appeared earlier in this message — any short text is inter-step narration.
      const prevToolExists = msg.parts.slice(0, i).some(isToolUIPart)
      const nextIsTool = msg.parts.slice(i + 1).some(isToolUIPart)
      // Treat as CoT narration when a tool comes next OR when we're mid-stream between steps
      // (prevToolExists means we already have schema/query steps behind us)
      if (isCoTNarration(text, nextIsTool || prevToolExists)) {
        pendingNarration = text
      } else {
        narrativeParts.push(part.text)
        pendingNarration = ""
      }
      continue
    }

    if (!isToolUIPart(part)) continue

    const toolName = resolveToolName(part)
    const input = ((part as { input?: unknown }).input ?? {}) as Record<string, unknown>
    const label = toolLabel(toolName)
    const detail = toolDetail(toolName, input)

    let state: CotStep["state"] = "running"
    if (isToolFinished(part)) {
      state = (part as { state?: string }).state === "output-error" ? "error" : "done"
    } else if (isToolRunning(part)) {
      state = "running"
    }

    if ((part as { state?: string }).state === "output-available") {
      const output = (part as { output: ChatToolResult }).output
      if (isDataTool(toolName)) {
        toolOutputs.push({ toolName, result: output })
      } else if (toolName === "clarify" && output?.type === "clarify" && output.question) {
        clarifyPrompt = { question: output.question, options: output.options }
      }
    }

    cotSteps.push({
      id: `${toolName}-${i}`,
      toolName,
      label,
      detail,
      narration:
        pendingNarration ||
        (toolName === "exploreSchema"
          ? `Checking available fields in ${detail || "schema"}.`
          : `Pulling ${label.toLowerCase()}${detail ? ` for ${detail}` : ""}.`),
      state,
      errorText:
        (part as { state?: string }).state === "output-error"
          ? (part as { errorText?: string }).errorText
          : undefined,
    })
    pendingNarration = ""
  }

  // Group exploreSchema steps
  const schemaSteps = cotSteps.filter((s) => s.toolName === "exploreSchema")
  let finalSteps = cotSteps
  if (schemaSteps.length >= 3) {
    const other = cotSteps.filter((s) => s.toolName !== "exploreSchema")
    const allDone = schemaSteps.every((s) => s.state === "done")
    const anyError = schemaSteps.some((s) => s.state === "error")
    finalSteps = [
      ...other,
      {
        id: "schema-group",
        toolName: "exploreSchema",
        label: `Used ${schemaSteps.length} tools`,
        detail: "",
        narration:
          pendingNarration ||
          "Explored schema and ran queries to assemble the full picture.",
        state: anyError ? "error" : allDone ? "done" : "running",
      },
    ]
  }

  return {
    cotSteps: finalSteps,
    narrativeParts,
    mergedData: mergeToolOutputs(toolOutputs),
    hasToolActivity: cotSteps.length > 0,
    clarifyPrompt,
  }
}
