import { createOpenAI } from "@ai-sdk/openai"
import { createAzure } from "@ai-sdk/azure"
import type { LanguageModel } from "ai"

const DEFAULT_AZURE_DEPLOYMENT = "Kimi-K2.6"
const DEFAULT_OPENAI_COMPAT_MODEL = "gpt-4o-mini"

export type ChatProvider = "azure" | "openai-compat"

export type ResolvedChatModel = {
  model: LanguageModel
  provider: ChatProvider
  modelId: string
  role: "primary" | "fallback"
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

function resolveAzureModel(deployment: string, role: ResolvedChatModel["role"]): ResolvedChatModel {
  return {
    model: makeAzureModel(deployment),
    provider: "azure",
    modelId: deployment,
    role,
  }
}

function resolveOpenAICompatModel(modelId: string, role: ResolvedChatModel["role"]): ResolvedChatModel {
  return {
    model: makeOpenAICompatModel(modelId),
    provider: "openai-compat",
    modelId,
    role,
  }
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

  return {
    ok: true as const,
    provider: primary.provider,
    modelId: primary.modelId,
    fallbackProvider: fallback?.provider ?? null,
    fallbackModelId: fallback?.modelId ?? null,
  }
}
