import { streamText, convertToModelMessages, UIMessage, stepCountIs, generateText } from "ai"
import { loadSchema } from "@/lib/cube-client"
import { buildChatSystemPrompt } from "@/lib/chat/system-prompt"
import { resolveChatModel, resolveFallbackModel, getChatProviderInfo } from "@/lib/chat/model"
import type { ResolvedChatModel } from "@/lib/chat/model"
import { createChatTools } from "@/lib/chat/tools"
import { serializeError, serverLog } from "@/lib/server-log"

const MODEL_HEALTH_TTL_MS = 60_000
let healthyPrimaryKey: string | null = null
let healthyPrimaryUntil = 0
let failedPrimaryKey: string | null = null
let failedPrimaryUntil = 0

function modelKey(model: ResolvedChatModel) {
  return `${model.provider}:${model.modelId}`
}

async function resolveAvailableModel(primary: ResolvedChatModel, fallback: ResolvedChatModel | null) {
  if (!fallback) return primary

  const now = Date.now()
  const primaryKey = modelKey(primary)
  if (healthyPrimaryKey === primaryKey && healthyPrimaryUntil > now) return primary
  if (failedPrimaryKey === primaryKey && failedPrimaryUntil > now) return fallback

  try {
    await generateText({
      model: primary.model,
      prompt: "Reply with OK.",
      maxOutputTokens: 4,
      maxRetries: 0,
      temperature: 0,
    })
    healthyPrimaryKey = primaryKey
    healthyPrimaryUntil = Date.now() + MODEL_HEALTH_TTL_MS
    return primary
  } catch (error) {
    failedPrimaryKey = primaryKey
    failedPrimaryUntil = Date.now() + MODEL_HEALTH_TTL_MS
    serverLog("warn", "primary model preflight failed, switching to fallback", {
      primary: primaryKey,
      fallback: modelKey(fallback),
      error: serializeError(error),
    })
    return fallback
  }
}

function buildStreamOptions(model: ResolvedChatModel["model"], systemPrompt: string, messages: Awaited<ReturnType<typeof convertToModelMessages>>, tools: ReturnType<typeof createChatTools>) {
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
  const fallback = resolveFallbackModel(primary)
  const active = await resolveAvailableModel(primary, fallback)
  serverLog("info", "chat model selected", {
    provider: active.provider,
    modelId: active.modelId,
    role: active.role,
    fallbackModelId: fallback?.modelId ?? null,
  })

  try {
    const result = streamText(buildStreamOptions(active.model, systemPrompt, convertedMessages, tools))
    return result.toUIMessageStreamResponse()
  } catch (e) {
    if (!fallback || active.role === "fallback") throw e
    serverLog("warn", "primary model failed before stream opened, switching to fallback", {
      primary: modelKey(active),
      fallback: modelKey(fallback),
      error: serializeError(e),
    })
    const result = streamText(buildStreamOptions(fallback.model, systemPrompt, convertedMessages, tools))
    return result.toUIMessageStreamResponse()
  }
}

export async function GET() {
  return Response.json(getChatProviderInfo())
}
