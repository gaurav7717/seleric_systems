import { NextResponse } from "next/server"
import { prisma } from "@multiagent/db"

export async function GET() {
  const actions = await prisma.pendingAction.findMany({
    where: { status: { in: ["EXECUTED", "FAILED"] } },
    orderBy: { executedAt: "desc" },
    take: 100,
    select: {
      id: true,
      agent: true,
      actionType: true,
      actionPayload: true,
      rationale: true,
      expectedOutcome: true,
      confidence: true,
      riskLevel: true,
      classification: true,
      status: true,
      executedAt: true,
      executionResult: true,
      executionError: true,
      approvedBy: true,
      signalId: true,
      signal: {
        select: {
          entityType: true,
          entityId: true,
          signalType: true,
          insights: {
            select: {
              outcomes: {
                select: { windowHours: true, outcomeScore: true, metricDeltas: true, measuredAt: true },
                orderBy: { windowHours: "asc" },
              },
            },
            take: 1,
          },
        },
      },
    },
  })

  return NextResponse.json(actions)
}
