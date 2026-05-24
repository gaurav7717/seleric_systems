import type { Job } from "bullmq"
import pino from "pino"

import { executePipeboardWrite } from "../processors/pipeboard"
import { executeShopifyWrite } from "../processors/shopify"

const logger = pino({ name: "job:execute-action" })

export async function processExecuteAction(job: Job) {
  const { actionId, agent, actionType, actionPayload } = job.data as {
    actionId: string
    agent: string
    actionType: string
    actionPayload: Record<string, unknown>
  }

  logger.info({ actionId, agent, actionType }, "executing_action")

  if (agent === "meta_agent") {
    return executePipeboardWrite(actionType, actionPayload)
  }
  if (agent === "shopify_agent") {
    return executeShopifyWrite(actionType, actionPayload)
  }

  throw new Error(`Unsupported agent for execution: ${agent}`)
}
