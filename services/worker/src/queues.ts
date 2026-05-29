import { Queue, Worker } from "bullmq"

import { processEmbedInsight } from "./jobs/embed-insight"
import { processExecuteAction } from "./jobs/execute-action"
import { processExpireActions } from "./jobs/expire-actions"
import { processRecordOutcome } from "./jobs/record-outcome"
import { processSendNotification } from "./jobs/send-notification"
import { redis } from "./lib/redis"

export const QUEUE_EXECUTE_ACTION = "execute-action"
export const QUEUE_SEND_NOTIFICATION = "send-notification"
export const QUEUE_RECORD_OUTCOME = "record-outcome"
export const QUEUE_EMBED_INSIGHT = "embed-insight"
export const QUEUE_EXPIRE_ACTIONS = "expire-actions"

export const executeActionQueue = new Queue(QUEUE_EXECUTE_ACTION, {
  connection: redis,
  defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 5_000 } },
})
export const sendNotificationQueue = new Queue(QUEUE_SEND_NOTIFICATION, { connection: redis })
export const recordOutcomeQueue = new Queue(QUEUE_RECORD_OUTCOME, {
  connection: redis,
  defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 10_000 } },
})
export const embedInsightQueue = new Queue(QUEUE_EMBED_INSIGHT, { connection: redis })
export const expireActionsQueue = new Queue(QUEUE_EXPIRE_ACTIONS, { connection: redis })

export async function registerWorkers() {
  new Worker(QUEUE_EXECUTE_ACTION, processExecuteAction, { connection: redis, concurrency: 5 })
  new Worker(QUEUE_SEND_NOTIFICATION, processSendNotification, { connection: redis })
  new Worker(QUEUE_RECORD_OUTCOME, processRecordOutcome, { connection: redis })
  new Worker(QUEUE_EMBED_INSIGHT, processEmbedInsight, { connection: redis })
  new Worker(QUEUE_EXPIRE_ACTIONS, processExpireActions, { connection: redis })

  // Run expiry check every 5 minutes
  await expireActionsQueue.add("expire-check", {}, {
    repeat: { every: 5 * 60 * 1000 },
    jobId: "expire-actions-cron",
  })
}
