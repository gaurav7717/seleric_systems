import OpenAI from "openai"
import pino from "pino"

const logger = pino({ name: "lib:embed" })

const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
})

export async function embedText(text: string): Promise<number[]> {
  if (!process.env.OPENAI_API_KEY) {
    logger.warn("OPENAI_API_KEY not set — skipping embedding")
    return []
  }
  const model = process.env.EMBEDDING_MODEL ?? "text-embedding-3-small"
  const response = await openaiClient.embeddings.create({ model, input: text })
  return response.data[0].embedding
}
