import { Queue } from "bullmq"
import Redis from "ioredis"

export const QUEUE_EXECUTE_ACTION = "execute-action"
export const QUEUE_SEND_NOTIFICATION = "send-notification"
export const QUEUE_RECORD_OUTCOME = "record-outcome"
export const QUEUE_EMBED_INSIGHT = "embed-insight"
export const QUEUE_EXPIRE_ACTIONS = "expire-actions"

export function createRedisConnection(): Redis {
  return new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  })
}

export function makeQueue(name: string): Queue {
  return new Queue(name, { connection: createRedisConnection() })
}
