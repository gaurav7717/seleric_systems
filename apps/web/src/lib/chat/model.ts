import { createOpenAI } from "@ai-sdk/openai"
import { createAzure } from "@ai-sdk/azure"

function makeAzureModel(deployment: string) {
  const apiKey = process.env.AZURE_OPENAI_API_KEY!
  const resourceName = new URL(process.env.AZURE_OPENAI_ENDPOINT!).hostname.split(".")[0]
  return createAzure({ resourceName, apiKey })(deployment)
}

export function resolveChatModel() {
  if (process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT) {
    return makeAzureModel(process.env.AZURE_ORCHESTRATOR_DEPLOYMENT ?? "Kimi-K2.6")
  }
  // OpenAI-compat / Ollama
  const apiKey = process.env.OPENAI_API_KEY ?? process.env.OLLAMA_CLOUD_API_KEY ?? "no-key"
  const baseURL = process.env.OLLAMA_CLOUD_URL ?? undefined
  const modelId = process.env.ORCHESTRATOR_MODEL ?? process.env.LLM_MODEL ?? "gpt-4o-mini"
  return createOpenAI({ baseURL, apiKey })(modelId)
}

/** Returns the Azure fallback model, or null if not configured. */
export function resolveFallbackModel() {
  if (process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_FALLBACK_DEPLOYMENT) {
    return makeAzureModel(process.env.AZURE_FALLBACK_DEPLOYMENT)
  }
  return null
}

export function getChatProviderInfo() {
  const hasAzure = !!(process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT)
  return {
    ok: true as const,
    provider: hasAzure ? "azure" : "openai-compat",
    modelId: hasAzure
      ? (process.env.AZURE_ORCHESTRATOR_DEPLOYMENT ?? "Kimi-K2.6")
      : (process.env.ORCHESTRATOR_MODEL ?? "gpt-4o-mini"),
    fallbackModelId: process.env.AZURE_FALLBACK_DEPLOYMENT ?? null,
  }
}
