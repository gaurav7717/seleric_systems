import type { Job } from "bullmq"
import pino from "pino"
import { prisma } from "@multiagent/db"
import { embedText } from "../lib/anthropic"

const logger = pino({ name: "job:embed-insight" })

export async function processEmbedInsight(job: Job) {
  const { insightId, text } = job.data as { insightId: string; text: string }
  logger.info({ insightId }, "embedding_insight")

  const embedding = await embedText(text)
  if (embedding.length === 0) {
    logger.warn({ insightId }, "embedding_empty_skipping_write")
    return { insightId, dimensions: 0 }
  }

  const vectorLiteral = `[${embedding.join(",")}]`
  await prisma.$executeRaw`UPDATE "Insight" SET embedding = ${vectorLiteral}::vector WHERE id = ${insightId}`

  logger.info({ insightId, dimensions: embedding.length }, "embedding_written")
  return { insightId, dimensions: embedding.length }
}
