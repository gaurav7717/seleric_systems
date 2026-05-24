import { getToolName, isToolUIPart, type DynamicToolUIPart, type UIMessage } from "ai"

export type ToolUIPartLike = Extract<UIMessage["parts"][number], { type: string }>

/** Resolve tool name for static (`tool-*`) and dynamic tool UI parts. */
export function resolveToolName(part: ToolUIPartLike): string {
  if (!isToolUIPart(part)) return "tool"
  try {
    return getToolName(part as DynamicToolUIPart)
  } catch {
    if (part.type === "dynamic-tool" && "toolName" in part) {
      return String((part as DynamicToolUIPart).toolName ?? "tool")
    }
    if (part.type.startsWith("tool-")) {
      return part.type.slice("tool-".length)
    }
    return "tool"
  }
}

export function isToolRunning(
  part: ToolUIPartLike
): boolean {
  if (!isToolUIPart(part)) return false
  const state = (part as { state?: string }).state
  return (
    state === "input-streaming" ||
    state === "input-available" ||
    state === "approval-requested" ||
    state === "approval-responded"
  )
}

export function isToolFinished(part: ToolUIPartLike): boolean {
  if (!isToolUIPart(part)) return false
  const state = (part as { state?: string }).state
  return state === "output-available" || state === "output-error" || state === "output-denied"
}
