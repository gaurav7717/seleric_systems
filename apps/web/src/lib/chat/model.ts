import { createOpenAI } from "@ai-sdk/openai"
import { createAzure } from "@ai-sdk/azure"

export function resolveChatModel() {
  if (process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT) {
    const deployment = process.env.AZURE_ORCHESTRATOR_DEPLOYMENT ?? "Kimi-K2.6"
    const resourceName = new URL(process.env.AZURE_OPENAI_ENDPOINT).hostname.split(".")[0]
    return createAzure({ resourceName, apiKey: process.env.AZURE_OPENAI_API_KEY })(deployment)
  }
  const apiKey = process.env.OPENAI_API_KEY ?? process.env.OLLAMA_CLOUD_API_KEY ?? "no-key"
  const baseURL = process.env.OLLAMA_CLOUD_URL ?? undefined
  const modelId = process.env.ORCHESTRATOR_MODEL ?? process.env.LLM_MODEL ?? "gpt-4o-mini"
  return createOpenAI({ baseURL, apiKey })(modelId)
}

export function getChatProviderInfo() {
  const hasAzure = !!(process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT)
  return {
    ok: true as const,
    provider: hasAzure ? "azure" : "openai-compat",
    modelId: hasAzure
      ? (process.env.AZURE_ORCHESTRATOR_DEPLOYMENT ?? "Kimi-K2.6")
      : (process.env.ORCHESTRATOR_MODEL ?? "gpt-4o-mini"),
  }
}
