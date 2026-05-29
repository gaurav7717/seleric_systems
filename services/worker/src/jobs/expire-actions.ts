import type { Job } from "bullmq"
import pino from "pino"
import { prisma } from "@multiagent/db"

const logger = pino({ name: "job:expire-actions" })

export async function processExpireActions(_job: Job) {
  const expired = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "PendingAction"
    SET status = 'EXPIRED'::"ActionStatus", "updatedAt" = NOW()
    WHERE status = 'PENDING'::"ActionStatus" AND "expiresAt" < NOW()
    RETURNING id
  `

  if (expired.length > 0) {
    const ids = expired.map((r) => r.id)
    await prisma.auditLog.createMany({
      data: ids.map((id) => ({
        event: "action_expired",
        actor: "system",
        payload: { actionId: id },
      })),
      skipDuplicates: true,
    })
    logger.info({ count: ids.length }, "actions_expired")
  }

  return { expired: expired.length }
}
