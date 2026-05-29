import type { Job } from "bullmq"
import pino from "pino"
import { prisma } from "@multiagent/db"

import { recordOutcomeQueue } from "../queues"
import { executePipeboardWrite } from "../processors/pipeboard"
import { executeShopifyWrite } from "../processors/shopify"

const logger = pino({ name: "job:execute-action" })

const hoursMs = (h: number) => h * 60 * 60 * 1000

export async function processExecuteAction(job: Job) {
  const { actionId, agent, actionType, actionPayload, signalId, entityId, entityType } = job.data as {
    actionId: string
    agent: string
    actionType: string
    actionPayload: Record<string, unknown>
    signalId?: string
    entityId?: string
    entityType?: string
  }

  logger.info({ actionId, agent, actionType }, "executing_action")

  let beforeState: Record<string, unknown> = {}
  try {
    beforeState = await fetchBeforeState(entityId, entityType)
  } catch (err) {
    logger.warn({ actionId, err }, "before_state_fetch_failed")
  }

  try {
    let response: unknown
    if (agent === "meta_agent") {
      response = await executePipeboardWrite(actionType, actionPayload)
    } else if (agent === "shopify_agent") {
      response = await executeShopifyWrite(actionType, actionPayload)
    } else {
      throw new Error(`Unsupported agent for execution: ${agent}`)
    }

    await prisma.pendingAction.update({
      where: { id: actionId },
      data: {
        status: "EXECUTED",
        executedAt: new Date(),
        executionResult: { beforeState, response, executor: agent },
      },
    })

    await prisma.auditLog.create({
      data: {
        signalId,
        event: "action_executed",
        actor: agent,
        payload: { actionId, actionType, beforeState },
      },
    })

    // Find the InsightCard linked to the same signal to track outcomes
    const linked = await prisma.insight.findFirst({
      where: { signalId: signalId ?? "" },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    })

    if (linked) {
      for (const [windowHours, delay] of [[24, hoursMs(24)], [48, hoursMs(48)], [168, hoursMs(168)]] as [number, number][]) {
        await recordOutcomeQueue.add(
          "record-outcome",
          { insightId: linked.id, actionId, windowHours, beforeState },
          { delay },
        )
      }
      logger.info({ actionId, insightId: linked.id }, "outcome_jobs_scheduled")
    }

    logger.info({ actionId, agent, actionType }, "action_executed_successfully")
    return { status: "executed", actionId }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    logger.error({ actionId, agent, actionType, err }, "action_execution_failed")

    await prisma.pendingAction
      .update({ where: { id: actionId }, data: { status: "FAILED", executionError: errorMsg } })
      .catch(() => {})

    await prisma.auditLog
      .create({
        data: {
          signalId,
          event: "action_failed",
          actor: agent,
          payload: { actionId, actionType, error: errorMsg },
        },
      })
      .catch(() => {})

    throw err // let BullMQ retry per backoff config
  }
}

async function fetchBeforeState(
  entityId: string | undefined,
  entityType: string | undefined,
): Promise<Record<string, unknown>> {
  if (!entityId) return {}
  const cubeUrl = process.env.CUBE_MCP_URL ?? process.env.MCP_CUBE_URL ?? ""
  if (!cubeUrl) return {}
  const apiKey = process.env.SELERIC_API_KEY ?? ""

  const resp = await fetch(
    `${cubeUrl}/metrics?entityId=${encodeURIComponent(entityId)}&entityType=${encodeURIComponent(entityType ?? "campaign")}`,
    { headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {} },
  )
  if (!resp.ok) return {}
  return (await resp.json()) as Record<string, unknown>
}
