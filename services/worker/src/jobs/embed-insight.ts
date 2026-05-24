import type { Job } from "bullmq"
import pino from "pino"

import { embedText } from "../lib/anthropic"

const logger = pino({ name: "job:embed-insight" })

export async function processEmbedInsight(job: Job) {
  const { insightId, text } = job.data as { insightId: string; text: string }
  logger.info({ insightId }, "embedding_insight")
  const embedding = await embedText(text)
  return { insightId, dimensions: embedding.length }
}
