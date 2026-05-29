import type { Job } from "bullmq"
import pino from "pino"
import { prisma } from "@multiagent/db"

const logger = pino({ name: "job:record-outcome" })

interface BeforeState {
  spend_7d?: number | null
  revenue_7d?: number | null
  net_profit_7d?: number | null
  today_spend?: number | null
  today_revenue?: number | null
  today_net_profit?: number | null
  [key: string]: unknown
}

function pctDelta(before: number | null | undefined, after: number | null | undefined): number | null {
  if (before == null || after == null || before === 0) return null
  return (after - before) / Math.abs(before)
}

function computeOutcomeScore(deltas: {
  roas_delta: number | null
  revenue_delta: number | null
  spend_delta: number | null
  net_profit_delta: number | null
}): number {
  const weights = [
    [deltas.roas_delta, 0.35],
    [deltas.revenue_delta, 0.35],
    [deltas.net_profit_delta, 0.2],
    [deltas.spend_delta ? -deltas.spend_delta : null, 0.1], // lower spend = positive
  ] as [number | null, number][]

  let weighted = 0
  let totalWeight = 0
  for (const [val, w] of weights) {
    if (val != null) {
      weighted += val * w
      totalWeight += w
    }
  }
  if (totalWeight === 0) return 0
  const raw = weighted / totalWeight
  return Math.max(-1, Math.min(1, raw))
}

export async function processRecordOutcome(job: Job) {
  const { insightId, actionId, windowHours, beforeState } = job.data as {
    insightId: string
    actionId: string
    windowHours: number
    beforeState: BeforeState
  }
  logger.info({ insightId, actionId, windowHours }, "recording_outcome")

  // Fetch current metrics from Cube
  const currentMetrics = await fetchCurrentMetrics(actionId)

  const metricDeltas = {
    roas_delta: pctDelta(
      beforeState.today_revenue && beforeState.today_spend
        ? (beforeState.today_revenue as number) / (beforeState.today_spend as number)
        : null,
      currentMetrics.today_revenue && currentMetrics.today_spend
        ? currentMetrics.today_revenue / currentMetrics.today_spend
        : null,
    ),
    spend_delta: pctDelta(beforeState.spend_7d, currentMetrics.spend_7d),
    revenue_delta: pctDelta(beforeState.revenue_7d, currentMetrics.revenue_7d),
    net_profit_delta: pctDelta(beforeState.net_profit_7d, currentMetrics.net_profit_7d),
  }

  const outcomeScore = computeOutcomeScore(metricDeltas)

  await prisma.insightOutcome.create({
    data: {
      insightId,
      measuredAt: new Date(),
      windowHours,
      metricDeltas,
      outcomeScore,
    },
  })

  logger.info({ insightId, actionId, windowHours, outcomeScore }, "outcome_recorded")

  // Trigger calibration signal if poor outcome at the 48h window
  if (outcomeScore < -0.5 && windowHours === 48) {
    const orchestratorUrl = process.env.ORCHESTRATOR_URL ?? "http://localhost:8000"
    const action = await prisma.pendingAction.findUnique({
      where: { id: actionId },
      select: { signalId: true, agent: true, actionType: true, signal: { select: { entityId: true, entityType: true } } },
    })
    if (action) {
      await fetch(`${orchestratorUrl}/signal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signal_id: `calibration-${actionId}-${windowHours}h`,
          entity_type: action.signal.entityType.toLowerCase(),
          entity_id: action.signal.entityId,
          signal_type: "poor_outcome_calibration",
          context_snapshot: { triggeredBy: actionId, outcomeScore, windowHours, metricDeltas },
        }),
      }).catch((err) => logger.warn({ err }, "calibration_signal_failed"))
    }
  }

  return { status: "recorded", insightId, windowHours, outcomeScore }
}

async function fetchCurrentMetrics(actionId: string): Promise<{
  today_spend?: number
  today_revenue?: number
  spend_7d?: number
  revenue_7d?: number
  net_profit_7d?: number
}> {
  const cubeUrl = process.env.CUBE_MCP_URL ?? process.env.MCP_CUBE_URL ?? ""
  if (!cubeUrl) return {}

  const action = await prisma.pendingAction.findUnique({
    where: { id: actionId },
    select: { signal: { select: { entityId: true, entityType: true } } },
  })
  if (!action) return {}

  const { entityId, entityType } = action.signal
  const apiKey = process.env.SELERIC_API_KEY ?? ""

  try {
    const resp = await fetch(
      `${cubeUrl}/metrics?entityId=${encodeURIComponent(entityId)}&entityType=${encodeURIComponent(entityType.toLowerCase())}`,
      { headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {} },
    )
    if (!resp.ok) return {}
    return (await resp.json()) as Record<string, number>
  } catch {
    return {}
  }
}
