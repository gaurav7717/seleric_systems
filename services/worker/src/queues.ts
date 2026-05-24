import { Queue, Worker } from "bullmq"

import { processEmbedInsight } from "./jobs/embed-insight"
import { processExecuteAction } from "./jobs/execute-action"
import { processRecordOutcome } from "./jobs/record-outcome"
import { processSendNotification } from "./jobs/send-notification"
import { redis } from "./lib/redis"

export const QUEUE_EXECUTE_ACTION = "execute-action"
export const QUEUE_SEND_NOTIFICATION = "send-notification"
export const QUEUE_RECORD_OUTCOME = "record-outcome"
export const QUEUE_EMBED_INSIGHT = "embed-insight"

export const executeActionQueue = new Queue(QUEUE_EXECUTE_ACTION, { connection: redis })
export const sendNotificationQueue = new Queue(QUEUE_SEND_NOTIFICATION, { connection: redis })
export const recordOutcomeQueue = new Queue(QUEUE_RECORD_OUTCOME, { connection: redis })
export const embedInsightQueue = new Queue(QUEUE_EMBED_INSIGHT, { connection: redis })

export async function registerWorkers() {
  new Worker(QUEUE_EXECUTE_ACTION, processExecuteAction, { connection: redis })
  new Worker(QUEUE_SEND_NOTIFICATION, processSendNotification, { connection: redis })
  new Worker(QUEUE_RECORD_OUTCOME, processRecordOutcome, { connection: redis })
  new Worker(QUEUE_EMBED_INSIGHT, processEmbedInsight, { connection: redis })
}
