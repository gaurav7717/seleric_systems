import { streamText, convertToModelMessages, UIMessage, stepCountIs } from "ai"
import { loadSchema } from "@/lib/cube-client"
import { buildChatSystemPrompt } from "@/lib/chat/system-prompt"
import { resolveChatModel, getChatProviderInfo } from "@/lib/chat/model"
import { createChatTools } from "@/lib/chat/tools"
import { serverLog } from "@/lib/server-log"

export async function POST(req: Request) {
  const body = await req.json()
  const messages: UIMessage[] = body.messages ?? []

  serverLog("info", "chat POST", { msgCount: messages.length })
  const schema = await loadSchema()
  serverLog("info", "schema loaded", { cubes: schema.cubes.map((c) => c.name) })

  const systemPrompt = buildChatSystemPrompt(schema)
  serverLog("info", "system prompt", { chars: systemPrompt.length, estimatedTokens: Math.round(systemPrompt.length / 4) })

  const result = streamText({
    model: resolveChatModel(),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(10),
    maxRetries: 0,
    tools: createChatTools(schema),
    experimental_onStepStart: ({ stepNumber }) => serverLog("info", `step #${stepNumber} start`),
    onStepFinish: ({ stepNumber, finishReason, toolResults, warnings }) => {
      if (warnings?.length) serverLog("warn", `step #${stepNumber} warnings`, warnings.map((w) => JSON.stringify(w)).join("; "))
      serverLog("info", `step #${stepNumber} finish`, {
        finishReason,
        tools: toolResults?.map((r) => `${r.toolName}:${(r as { state?: string }).state ?? "?"}`)
      })
    },
    onError: ({ error }) => {
      // Properly serialize – plain objects from Azure SDK show as [object Object] with String()
      const msg = error instanceof Error
        ? `${error.name}: ${error.message}`
        : (() => { try { return JSON.stringify(error) } catch { return String(error) } })()
      serverLog("error", "streamText error", msg)
    },
  })

  return result.toUIMessageStreamResponse()
}

export async function GET() {
  return Response.json(getChatProviderInfo())
}
