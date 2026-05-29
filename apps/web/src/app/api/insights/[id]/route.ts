import { NextResponse } from "next/server"
import { prisma } from "@multiagent/db"

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const { id } = params
  const body: { action: "dismiss" | "snooze"; snoozeDuration?: 1 | 4 | 24 } =
    await request.json()

  if (body.action === "dismiss") {
    await prisma.insight.update({
      where: { id },
      data: { dismissedAt: new Date() },
    })
    return NextResponse.json({ ok: true, action: "dismissed" })
  }

  if (body.action === "snooze") {
    const hours = body.snoozeDuration ?? 1
    const until = new Date(Date.now() + hours * 60 * 60 * 1000)
    await prisma.insight.update({
      where: { id },
      data: { snoozedUntil: until },
    })
    return NextResponse.json({ ok: true, action: "snoozed", until })
  }

  return NextResponse.json({ error: "invalid action" }, { status: 400 })
}
