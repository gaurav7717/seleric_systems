import { createOpenAI } from "@ai-sdk/openai"
import { createAzure } from "@ai-sdk/azure"
import { wrapLanguageModel, defaultSettingsMiddleware } from "ai"
import type { LanguageModel } from "ai"

const DEFAULT_AZURE_DEPLOYMENT = "Kimi-K2.6"
const DEFAULT_OPENAI_COMPAT_MODEL = "gpt-4o-mini"

export type ChatProvider = "azure" | "openai-compat"

export type ChatModelRole = "primary" | "fallback" | "data" | "analysis"

export type ResolvedChatModel = {
  model: LanguageModel
  provider: ChatProvider
  modelId: string
  role: ChatModelRole
}

function hasAzureConfig() {
  return !!(process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT)
}

function getOpenAICompatModelId() {
  return process.env.ORCHESTRATOR_MODEL ?? process.env.LLM_MODEL ?? (process.env.OPENAI_API_KEY ? DEFAULT_OPENAI_COMPAT_MODEL : null)
}

function hasOpenAICompatConfig() {
  return !!(getOpenAICompatModelId() && (process.env.OPENAI_API_KEY || process.env.OLLAMA_CLOUD_API_KEY || process.env.OLLAMA_CLOUD_URL))
}

function makeAzureModel(deployment: string): LanguageModel {
  const apiKey = process.env.AZURE_OPENAI_API_KEY!
  const resourceName = new URL(process.env.AZURE_OPENAI_ENDPOINT!).hostname.split(".")[0]
  return createAzure({ resourceName, apiKey })(deployment)
}

function makeOpenAICompatModel(modelId: string): LanguageModel {
  const apiKey = process.env.OPENAI_API_KEY ?? process.env.OLLAMA_CLOUD_API_KEY ?? "no-key"
  const baseURL = process.env.OLLAMA_CLOUD_URL ?? undefined
  return createOpenAI({ baseURL, apiKey })(modelId)
}

function resolveAzureModel(deployment: string, role: ChatModelRole): ResolvedChatModel {
  return { model: makeAzureModel(deployment), provider: "azure", modelId: deployment, role }
}

function resolveOpenAICompatModel(modelId: string, role: ChatModelRole): ResolvedChatModel {
  return { model: makeOpenAICompatModel(modelId), provider: "openai-compat", modelId, role }
}

export function resolveChatModel(): ResolvedChatModel {
  if (hasAzureConfig()) {
    return resolveAzureModel(process.env.AZURE_ORCHESTRATOR_DEPLOYMENT ?? DEFAULT_AZURE_DEPLOYMENT, "primary")
  }
  const openAICompatModelId = getOpenAICompatModelId()
  if (openAICompatModelId && hasOpenAICompatConfig()) {
    return resolveOpenAICompatModel(openAICompatModelId, "primary")
  }
  return resolveOpenAICompatModel(openAICompatModelId ?? DEFAULT_OPENAI_COMPAT_MODEL, "primary")
}

/**
 * Data model — handles tool-calling steps (schema exploration, cube queries).
 * Should be a fast model with high rate limits and relaxed cost per call.
 *
 * Configure:
 *   AZURE_DATA_DEPLOYMENT=DeepSeek-V4-Pro   (Azure deployment name)
 *   DATA_MODEL=some-model-id                (OpenAI-compat override)
 *
 * Falls back to the primary model if unconfigured.
 */
export function resolveDataModel(): ResolvedChatModel {
  if (hasAzureConfig()) {
    const deployment = process.env.AZURE_DATA_DEPLOYMENT ?? process.env.AZURE_FALLBACK_DEPLOYMENT
    if (deployment) return resolveAzureModel(deployment, "data")
  }
  const compatModelId = process.env.DATA_MODEL ?? getOpenAICompatModelId()
  if (compatModelId && hasOpenAICompatConfig()) {
    return resolveOpenAICompatModel(compatModelId, "data")
  }
  return { ...resolveChatModel(), role: "data" }
}

/**
 * Analysis model — handles the final insight/text step.
 * Should be the highest-quality model available.
 *
 * Configure:
 *   AZURE_ANALYSIS_DEPLOYMENT=Kimi-K2.6     (Azure deployment name)
 *   ANALYSIS_MODEL=some-model-id            (OpenAI-compat override)
 *
 * Falls back to the primary model if unconfigured.
 */
export function resolveAnalysisModel(): ResolvedChatModel {
  if (hasAzureConfig()) {
    const deployment = process.env.AZURE_ANALYSIS_DEPLOYMENT ?? process.env.AZURE_ORCHESTRATOR_DEPLOYMENT
    if (deployment) return resolveAzureModel(deployment, "analysis")
  }
  const compatModelId = process.env.ANALYSIS_MODEL ?? getOpenAICompatModelId()
  if (compatModelId && hasOpenAICompatConfig()) {
    return resolveOpenAICompatModel(compatModelId, "analysis")
  }
  return { ...resolveChatModel(), role: "analysis" }
}

function parseTemp(raw: string | undefined, fallback: number): number {
  if (raw == null) return fallback
  const n = parseFloat(raw)
  return isFinite(n) ? Math.max(0, Math.min(2, n)) : fallback
}

/** Temperature for tool-calling steps — should be 0 for determinism. */
export function getDataTemperature(): number {
  return parseTemp(process.env.AZURE_DATA_TEMPERATURE ?? process.env.CHAT_DATA_TEMPERATURE, 0)
}

/** Temperature for the final analysis/insight step. */
export function getAnalysisTemperature(): number {
  return parseTemp(
    process.env.AZURE_ORCHESTRATOR_TEMPERATURE ?? process.env.CHAT_ANALYSIS_TEMPERATURE,
    0.1
  )
}

/**
 * Returns a model instance with the given temperature baked in via middleware,
 * so it can be used in prepareStep where per-step temperature is not directly settable.
 */
export function withTemperature(base: LanguageModel, temperature: number): LanguageModel {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return wrapLanguageModel({
    model: base as Parameters<typeof wrapLanguageModel>[0]["model"],
    middleware: defaultSettingsMiddleware({ settings: { temperature } }),
  })
}

/** Returns the configured fallback model, or null if no distinct fallback exists. */
export function resolveFallbackModel(primary = resolveChatModel()): ResolvedChatModel | null {
  if (hasAzureConfig()) {
    const fallbackDeployment = process.env.AZURE_FALLBACK_DEPLOYMENT
    if (fallbackDeployment && !(primary.provider === "azure" && primary.modelId === fallbackDeployment)) {
      return resolveAzureModel(fallbackDeployment, "fallback")
    }
    const azurePrimaryDeployment = process.env.AZURE_ORCHESTRATOR_DEPLOYMENT
    if (azurePrimaryDeployment && primary.provider !== "azure") {
      return resolveAzureModel(azurePrimaryDeployment, "fallback")
    }
  }
  const openAICompatModelId = getOpenAICompatModelId()
  if (openAICompatModelId && hasOpenAICompatConfig() && primary.provider !== "openai-compat") {
    return resolveOpenAICompatModel(openAICompatModelId, "fallback")
  }
  return null
}

export function getChatProviderInfo() {
  const primary = resolveChatModel()
  const fallback = resolveFallbackModel(primary)
  const data = resolveDataModel()
  const analysis = resolveAnalysisModel()

  return {
    ok: true as const,
    provider: primary.provider,
    modelId: primary.modelId,
    fallbackProvider: fallback?.provider ?? null,
    fallbackModelId: fallback?.modelId ?? null,
    dataModelId: data.modelId !== primary.modelId ? data.modelId : null,
    analysisModelId: analysis.modelId !== primary.modelId ? analysis.modelId : null,
    dataTemperature: getDataTemperature(),
    analysisTemperature: getAnalysisTemperature(),
  }
}
