import { createHmac, timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "@multiagent/db"
import { Queue } from "bullmq"
import Redis from "ioredis"

function verifyToken(actionId: string, signalId: string, token: string): boolean {
  const secret = process.env.APPROVAL_SECRET ?? "dev-secret-change-in-prod"
  const msg = `${actionId}:${signalId}`
  const expected = createHmac("sha256", secret).update(msg).digest("base64url").replace(/=/g, "")
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected))
  } catch {
    return false
  }
}

function getExecuteQueue(): Queue {
  const redisConn = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  })
  return new Queue("execute-action", { connection: redisConn })
}

async function applyDecision(
  id: string,
  token: string,
  decision: "approved" | "rejected",
  body: { rejectedReason?: string; modifiedPayload?: Record<string, unknown> } = {},
): Promise<NextResponse> {
  const action = await prisma.pendingAction.findUnique({
    where: { id },
    select: { id: true, status: true, expiresAt: true, signalId: true, agent: true, actionType: true, actionPayload: true },
  })

  if (!action) return NextResponse.json({ error: "not_found" }, { status: 404 })
  if (action.status !== "PENDING") return NextResponse.json({ error: "already_actioned", status: action.status }, { status: 409 })
  if (action.expiresAt < new Date()) return NextResponse.json({ error: "expired" }, { status: 410 })
  if (!verifyToken(id, action.signalId, token)) return NextResponse.json({ error: "invalid_token" }, { status: 403 })

  const actor = "founder"

  if (decision === "approved") {
    const finalPayload = body.modifiedPayload ?? action.actionPayload

    await prisma.pendingAction.update({
      where: { id },
      data: { status: "APPROVED", approvedBy: actor, approvedAt: new Date(), actionPayload: finalPayload as object },
    })
    await prisma.auditLog.create({
      data: {
        signalId: action.signalId,
        event: "action_approved",
        actor,
        payload: { actionId: id, actionType: action.actionType, modifiedPayload: !!body.modifiedPayload },
      },
    })

    const queue = getExecuteQueue()
    await queue.add("exec", {
      actionId: id,
      agent: action.agent,
      actionType: action.actionType,
      actionPayload: finalPayload,
      signalId: action.signalId,
    })
    await queue.close()

    return NextResponse.json({ status: "approved", actionId: id })
  } else {
    await prisma.pendingAction.update({
      where: { id },
      data: {
        status: "REJECTED",
        rejectedReason: body.rejectedReason ?? "Rejected by founder",
        rejectedAt: new Date(),
      },
    })
    await prisma.auditLog.create({
      data: {
        signalId: action.signalId,
        event: "action_rejected",
        actor,
        payload: { actionId: id, actionType: action.actionType, reason: body.rejectedReason },
      },
    })

    return NextResponse.json({ status: "rejected", actionId: id })
  }
}

// GET: direct approve/reject from email links (?token=...&decision=approved|rejected)
export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const { id } = params
  const url = new URL(request.url)
  const token = url.searchParams.get("token") ?? ""
  const decision = url.searchParams.get("decision") as "approved" | "rejected" | null
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin

  if (!decision || !["approved", "rejected"].includes(decision)) {
    return NextResponse.redirect(new URL(`/control/approvals?highlight=${id}`, appUrl))
  }

  const result = await applyDecision(id, token, decision)
  const resultData = await result.clone().json() as { status?: string }
  if (resultData.status === "approved" || resultData.status === "rejected") {
    return NextResponse.redirect(new URL(`/control/approvals?actioned=${decision}&id=${id}`, appUrl))
  }
  return result
}

// POST: called from the control panel UI
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const { id } = params
  const url = new URL(request.url)
  const token = url.searchParams.get("token") ?? ""

  let body: { decision?: string; rejectedReason?: string; modifiedPayload?: Record<string, unknown> } = {}
  try {
    body = await request.json()
  } catch {
    // no body is fine if decision comes from query
  }

  const decision = body.decision as "approved" | "rejected" | undefined
  if (!decision || !["approved", "rejected"].includes(decision)) {
    return NextResponse.json({ error: "decision must be 'approved' or 'rejected'" }, { status: 400 })
  }

  return applyDecision(id, token, decision, body)
}
