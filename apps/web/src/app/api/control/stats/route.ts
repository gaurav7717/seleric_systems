import { NextResponse } from "next/server"
import { prisma } from "@multiagent/db"

export async function GET() {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [
    pendingCount,
    executedToday,
    approvedLast7d,
    rejectedLast7d,
    avgOutcomeRaw,
    perAgentActions,
    perAgentDecisions,
  ] = await Promise.all([
    prisma.pendingAction.count({
      where: { status: "PENDING", expiresAt: { gt: now } },
    }),
    prisma.pendingAction.count({
      where: { status: "EXECUTED", executedAt: { gte: todayStart } },
    }),
    prisma.pendingAction.count({
      where: { status: "APPROVED", approvedAt: { gte: sevenDaysAgo } },
    }),
    prisma.pendingAction.count({
      where: { status: "REJECTED", rejectedAt: { gte: sevenDaysAgo } },
    }),
    prisma.insightOutcome.aggregate({
      _avg: { outcomeScore: true },
      where: { measuredAt: { gte: thirtyDaysAgo } },
    }),
    prisma.pendingAction.groupBy({
      by: ["agent"],
      _count: { id: true },
      where: { createdAt: { gte: sevenDaysAgo } },
    }),
    prisma.pendingAction.groupBy({
      by: ["agent", "status"],
      _count: { id: true },
      where: {
        status: { in: ["APPROVED", "REJECTED"] },
        createdAt: { gte: sevenDaysAgo },
      },
    }),
  ])

  const approvalRate =
    approvedLast7d + rejectedLast7d > 0
      ? approvedLast7d / (approvedLast7d + rejectedLast7d)
      : null

  const agentMap: Record<string, { proposalCount: number; approved: number; rejected: number }> = {}
  for (const row of perAgentActions) {
    agentMap[row.agent] = { proposalCount: row._count.id, approved: 0, rejected: 0 }
  }
  for (const row of perAgentDecisions) {
    if (!agentMap[row.agent])
      agentMap[row.agent] = { proposalCount: 0, approved: 0, rejected: 0 }
    if (row.status === "APPROVED") agentMap[row.agent].approved = row._count.id
    if (row.status === "REJECTED") agentMap[row.agent].rejected = row._count.id
  }

  const perAgent = Object.entries(agentMap).map(([agent, v]) => ({
    agent,
    proposalCount: v.proposalCount,
    approvalRate:
      v.approved + v.rejected > 0
        ? v.approved / (v.approved + v.rejected)
        : null,
  }))

  return NextResponse.json({
    pendingCount,
    executedToday,
    approvalRate,
    avgOutcomeScore: avgOutcomeRaw._avg.outcomeScore,
    perAgent,
  })
}
