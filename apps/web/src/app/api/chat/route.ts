import { streamText, convertToModelMessages, UIMessage, stepCountIs, generateText } from "ai"
import { loadSchema } from "@/lib/cube-client"
import { buildChatSystemPrompt } from "@/lib/chat/system-prompt"
import {
  resolveChatModel,
  resolveFallbackModel,
  resolveDataModel,
  resolveAnalysisModel,
  getDataTemperature,
  getAnalysisTemperature,
  withTemperature,
  getChatProviderInfo,
} from "@/lib/chat/model"
import type { ResolvedChatModel } from "@/lib/chat/model"
import { createChatTools } from "@/lib/chat/tools"
import { serializeError, serverLog } from "@/lib/server-log"

const MODEL_HEALTH_TTL_MS = 60_000
// Rate limits on Azure typically persist several minutes — use a longer TTL
const RATE_LIMIT_TTL_MS = 5 * 60_000

let healthyPrimaryKey: string | null = null
let healthyPrimaryUntil = 0
let failedPrimaryKey: string | null = null
let failedPrimaryUntil = 0

function modelKey(model: ResolvedChatModel) {
  return `${model.provider}:${model.modelId}`
}

function markPrimaryFailed(key: string, ttlMs = MODEL_HEALTH_TTL_MS) {
  failedPrimaryKey = key
  failedPrimaryUntil = Date.now() + ttlMs
  if (healthyPrimaryKey === key) healthyPrimaryUntil = 0
}

/**
 * Detects rate-limit errors regardless of how the SDK wraps them.
 * The Azure / OpenAI-compat SDKs may throw:
 *   - an Error subclass with .statusCode === 429 or .message containing "Too Many Requests"
 *   - a plain object { error: { type: "too_many_requests" } }
 * Using JSON serialization as a broad net catches all shapes.
 */
function isRateLimitError(error: unknown): boolean {
  let s = ""
  try { s = typeof error === "string" ? error : JSON.stringify(error) } catch { s = String(error) }
  const lower = s.toLowerCase()
  if (
    lower.includes("too_many_requests") ||
    lower.includes("too many requests") ||
    lower.includes("rate_limit") ||
    lower.includes("rate limit")
  ) return true

  if (typeof error === "object" && error !== null) {
    const e = error as Record<string, unknown>
    if (e.statusCode === 429 || e.status === 429) return true
    if (typeof e.error === "object" && e.error !== null) {
      const inner = e.error as Record<string, unknown>
      if (inner.statusCode === 429 || inner.status === 429) return true
      if (String(inner.type ?? "").includes("too_many_requests") || String(inner.code ?? "").includes("too_many_requests")) return true
    }
  }

  return false
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
    const ttl = isRateLimitError(error) ? RATE_LIMIT_TTL_MS : MODEL_HEALTH_TTL_MS
    markPrimaryFailed(primaryKey, ttl)
    serverLog("warn", "primary model preflight failed, switching to fallback", {
      primary: primaryKey,
      fallback: modelKey(fallback),
      error: serializeError(error),
    })
    return fallback
  }
}

/**
 * Multi-model routing strategy
 *
 * Tool-calling steps are routed to the DATA model (e.g. DeepSeek-V4-Pro) at temperature=0.
 * After CHAT_MAX_TOOL_STEPS, the ANALYSIS model (Kimi-K2.6) takes over for the final text.
 *
 * Two distinct limits — intentionally separate:
 *   CHAT_MAX_TOOL_STEPS (default 20) — model routing threshold: after this many steps the
 *     analysis model is used. Does NOT stop the stream; the model keeps reasoning freely.
 *   CHAT_SAFETY_STEP_CAP (default 30) — absolute loop-prevention only. Never set this low —
 *     the chain of thought must be allowed to run to a natural conclusion.
 *
 * There are NO maxOutputTokens limits on tool-calling or reasoning steps. Only the final
 * analysis step may be bounded (see prepareStep analysis override below).
 *
 * Configure via .env:
 *   AZURE_DATA_DEPLOYMENT=DeepSeek-V4-Pro       — data model (all tool steps, temp=0)
 *   AZURE_ANALYSIS_DEPLOYMENT=Kimi-K2.6         — analysis model (final text)
 *   AZURE_ORCHESTRATOR_TEMPERATURE=0.1          — analysis temperature
 *   AZURE_DATA_TEMPERATURE=0                    — data temperature (default 0)
 *   CHAT_MAX_TOOL_STEPS=20                      — routing hand-off (not a stop limit)
 *   CHAT_SAFETY_STEP_CAP=30                     — runaway-loop guard only
 */
function buildStreamOptions(
  model: ResolvedChatModel["model"],
  systemPrompt: string,
  messages: Awaited<ReturnType<typeof convertToModelMessages>>,
  tools: ReturnType<typeof createChatTools>,
  onRateLimitError?: () => void,
) {
  const dataModel = resolveDataModel()
  const analysisModel = resolveAnalysisModel()

  // Routing threshold: how many steps to keep on the data model before handing off.
  const maxToolSteps = Math.max(1, parseInt(process.env.CHAT_MAX_TOOL_STEPS ?? "20"))
  // Absolute safety cap — prevents runaway loops only, never set this low.
  const safetyStepCap = Math.max(maxToolSteps + 2, parseInt(process.env.CHAT_SAFETY_STEP_CAP ?? "30"))

  // Bake temperature into each model so prepareStep can swap them without losing temp config.
  const dataModelReady = withTemperature(dataModel.model, getDataTemperature())
  const analysisModelReady = withTemperature(analysisModel.model, getAnalysisTemperature())

  const isSplitEnabled = dataModel.modelId !== analysisModel.modelId

  serverLog("info", "model routing", {
    dataModel: dataModel.modelId,
    analysisModel: analysisModel.modelId,
    split: isSplitEnabled,
    maxToolSteps,
    safetyStepCap,
    dataTemp: getDataTemperature(),
    analysisTemp: getAnalysisTemperature(),
  })

  return {
    model: isSplitEnabled ? dataModelReady : model,
    system: systemPrompt,
    messages,
    // Temperature is controlled per-step via wrapLanguageModel when split is active.
    // When both models are the same, use data temperature (0) for determinism.
    temperature: isSplitEnabled ? undefined : getDataTemperature(),
    // safetyStepCap is a loop-prevention guard only — it must never cut off real reasoning.
    stopWhen: stepCountIs(safetyStepCap),
    maxRetries: 0,
    tools,
    ...(isSplitEnabled && {
      prepareStep: ({ stepNumber }: { stepNumber: number }) => {
        if (stepNumber >= maxToolSteps) {
          serverLog("info", `prepareStep #${stepNumber}: handing off to analysis model (${analysisModel.modelId})`)
          // Disable tools so the analysis model produces the final answer text only.
          return { model: analysisModelReady, activeTools: [] as never[] }
        }
        return {}
      },
    }),
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
      if (isRateLimitError(error) && onRateLimitError) {
        onRateLimitError()
      }
    },
  }
}

/**
 * Wraps the primary stream response with transparent fallback on rate limit.
 *
 * Strategy: read the primary's byte stream and buffer chunks until we see user-visible
 * text (lines starting with "0:" in the AI SDK data-stream protocol). If a rate-limit
 * error arrives before any text has been flushed, we discard the buffer and restart
 * with the fallback model — the client sees no error. If the rate limit hits after text
 * has been sent we can't restart, so we mark primary failed and let the error through
 * (the user retries and the next request auto-selects fallback).
 */
async function streamWithTransparentFallback(
  primaryResponse: Response,
  fallback: ResolvedChatModel,
  primaryKey: string,
  systemPrompt: string,
  messages: Awaited<ReturnType<typeof convertToModelMessages>>,
  tools: ReturnType<typeof createChatTools>,
): Promise<Response> {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
  const writer = writable.getWriter()
  const reader = primaryResponse.body!.getReader()
  const decoder = new TextDecoder()

  // Copy headers but use our controlled readable as the body
  const headers = new Headers(primaryResponse.headers)

  ;(async () => {
    const pendingChunks: Uint8Array[] = []
    let textSeen = false

    try {
      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          // Stream ended normally — flush any buffered chunks
          for (const c of pendingChunks) await writer.write(c)
          await writer.close()
          return
        }

        const text = decoder.decode(value, { stream: true })

        // AI SDK data-stream protocol: text deltas are lines starting with "0:"
        if (/(?:^|\n)0:/.test(text)) textSeen = true

        if (!textSeen) {
          // Haven't sent anything user-visible yet — check for rate limit in this chunk
          if (text.toLowerCase().includes("too_many_requests") || text.toLowerCase().includes("too many requests")) {
            markPrimaryFailed(primaryKey, RATE_LIMIT_TTL_MS)
            serverLog("warn", "rate limit before user text — transparent switch to fallback", {
              primary: primaryKey,
              fallback: modelKey(fallback),
            })

            // Start fallback and pipe it directly (buffer is discarded)
            const fbResult = streamText(buildStreamOptions(fallback.model, systemPrompt, messages, tools))
            const fbReader = fbResult.toUIMessageStreamResponse().body!.getReader()
            while (true) {
              const { done: fd, value: fv } = await fbReader.read()
              if (fd) { await writer.close(); return }
              await writer.write(fv)
            }
          }

          // No rate limit yet — keep buffering until we see text
          pendingChunks.push(value)
        } else {
          // Text has started — flush any pending buffer once, then write through
          if (pendingChunks.length > 0) {
            for (const c of pendingChunks) await writer.write(c)
            pendingChunks.length = 0
          }
          await writer.write(value)
        }
      }
    } catch (err) {
      await writer.abort(err)
    }
  })()

  return new Response(readable, { headers })
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

  const primaryKey = modelKey(primary)
  const onRateLimitError =
    active.role === "primary" && fallback
      ? () => {
          serverLog("warn", "rate limit mid-stream, marking primary failed", { primary: primaryKey })
          markPrimaryFailed(primaryKey, RATE_LIMIT_TTL_MS)
        }
      : undefined

  try {
    const result = streamText(buildStreamOptions(active.model, systemPrompt, convertedMessages, tools, onRateLimitError))
    const response = result.toUIMessageStreamResponse()

    // Wrap with transparent fallback only when primary is active and a fallback is configured
    if (active.role === "primary" && fallback) {
      return streamWithTransparentFallback(response, fallback, primaryKey, systemPrompt, convertedMessages, tools)
    }

    return response
  } catch (e) {
    if (!fallback || active.role === "fallback") throw e
    const ttl = isRateLimitError(e) ? RATE_LIMIT_TTL_MS : MODEL_HEALTH_TTL_MS
    markPrimaryFailed(primaryKey, ttl)
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
