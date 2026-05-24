import type { Job } from "bullmq"
import pino from "pino"

const logger = pino({ name: "job:record-outcome" })

export async function processRecordOutcome(job: Job) {
  const { insightId, windowHours } = job.data as { insightId: string; windowHours: number }
  logger.info({ insightId, windowHours }, "recording_outcome")
  return { status: "pending", insightId }
}
