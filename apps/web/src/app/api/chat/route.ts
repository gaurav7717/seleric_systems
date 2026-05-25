import { streamText, convertToModelMessages, UIMessage, stepCountIs } from "ai"
import { loadSchema } from "@/lib/cube-client"
import { buildChatSystemPrompt } from "@/lib/chat/system-prompt"
import { resolveChatModel, resolveFallbackModel, getChatProviderInfo } from "@/lib/chat/model"
import { createChatTools } from "@/lib/chat/tools"
import { serverLog } from "@/lib/server-log"

function buildStreamOptions(model: ReturnType<typeof resolveChatModel>, systemPrompt: string, messages: Awaited<ReturnType<typeof convertToModelMessages>>, tools: ReturnType<typeof createChatTools>) {
  return {
    model,
    system: systemPrompt,
    messages,
    stopWhen: stepCountIs(10),
    maxRetries: 0,
    tools,
    experimental_onStepStart: ({ stepNumber }: { stepNumber: number }) => serverLog("info", `step #${stepNumber} start`),
    onStepFinish: ({ stepNumber, finishReason, toolResults, warnings }: { stepNumber: number; finishReason: string; toolResults?: { toolName: string; state?: string }[]; warnings?: unknown[] }) => {
      if (warnings?.length) serverLog("warn", `step #${stepNumber} warnings`, warnings.map((w) => JSON.stringify(w)).join("; "))
      serverLog("info", `step #${stepNumber} finish`, {
        finishReason,
        tools: toolResults?.map((r) => `${r.toolName}:${r.state ?? "?"}`)
      })
    },
    onError: ({ error }: { error: unknown }) => {
      const msg = error instanceof Error
        ? `${error.name}: ${error.message}`
        : (() => { try { return JSON.stringify(error) } catch { return String(error) } })()
      serverLog("error", "streamText error", msg)
    },
  }
}

export async function POST(req: Request) {
  const body = await req.json()
  const messages: UIMessage[] = body.messages ?? []

  serverLog("info", "chat POST", { msgCount: messages.length })
  const schema = await loadSchema()
  serverLog("info", "schema loaded", { cubes: schema.cubes.map((c) => c.name) })

  const systemPrompt = buildChatSystemPrompt(schema)
  serverLog("info", "system prompt", { chars: systemPrompt.length, estimatedTokens: Math.round(systemPrompt.length / 4) })

  const convertedMessages = await convertToModelMessages(messages)
  const tools = createChatTools(schema)
  const primary = resolveChatModel()
  const fallback = resolveFallbackModel()

  try {
    const result = streamText(buildStreamOptions(primary, systemPrompt, convertedMessages, tools))
    return result.toUIMessageStreamResponse()
  } catch (e) {
    if (!fallback) throw e
    const msg = e instanceof Error ? e.message : String(e)
    serverLog("warn", "primary model failed, switching to fallback", msg)
    const result = streamText(buildStreamOptions(fallback, systemPrompt, convertedMessages, tools))
    return result.toUIMessageStreamResponse()
  }
}

export async function GET() {
  return Response.json(getChatProviderInfo())
}
