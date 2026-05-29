import { NextResponse } from "next/server"
import { prisma } from "@multiagent/db"

export async function GET() {
  const actions = await prisma.pendingAction.findMany({
    where: {
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    orderBy: [
      { expiresAt: "asc" },
    ],
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
      guardrailRule: true,
      expiresAt: true,
      createdAt: true,
      signalId: true,
      signal: {
        select: { entityType: true, entityId: true, signalType: true },
      },
    },
  })

  // Sort HIGH risk first within each expiry bucket
  const sorted = actions.sort((a, b) => {
    const exp = a.expiresAt.getTime() - b.expiresAt.getTime()
    if (exp !== 0) return exp
    const riskOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }
    return (riskOrder[a.riskLevel] ?? 1) - (riskOrder[b.riskLevel] ?? 1)
  })

  return NextResponse.json(sorted)
}
