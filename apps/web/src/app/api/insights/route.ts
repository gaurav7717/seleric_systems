import { NextResponse } from "next/server"
import { prisma } from "@multiagent/db"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 200)
  const severity = searchParams.get("severity") // CRITICAL | WARNING | INFO | null (all)
  const cursor = searchParams.get("cursor") // ISO datetime for pagination

  try {
    const insights = await prisma.insight.findMany({
      where: {
        ...(severity ? { severity: severity as "CRITICAL" | "WARNING" | "INFO" } : {}),
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
        dismissedAt: null,
        OR: [{ snoozedUntil: null }, { snoozedUntil: { lt: new Date() } }],
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        severity: true,
        title: true,
        what: true,
        why: true,
        evidence: true,
        confidence: true,
        agent: true,
        createdAt: true,
        signalId: true,
        signal: {
          select: { entityType: true, entityId: true, signalType: true, firedAt: true },
        },
      },
    })
    return NextResponse.json(insights)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[api/insights] error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
