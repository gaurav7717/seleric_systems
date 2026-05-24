import pino from "pino"
import { Resend } from "resend"
import { IncomingWebhook } from "@slack/webhook"

const logger = pino({ name: "processor:notifications" })

export async function sendApprovalNotification(data: Record<string, unknown>) {
  const slackUrl = process.env.SLACK_WEBHOOK_URL
  if (slackUrl) {
    const webhook = new IncomingWebhook(slackUrl)
    await webhook.send({ text: `Approval required: ${JSON.stringify(data)}` })
  }

  const resendKey = process.env.RESEND_API_KEY
  const to = process.env.NOTIFICATION_EMAIL
  if (resendKey && to) {
    const resend = new Resend(resendKey)
    await resend.emails.send({
      from: process.env.NOTIFICATION_FROM ?? "alerts@multiagent.local",
      to,
      subject: "Action pending approval",
      html: `<pre>${JSON.stringify(data, null, 2)}</pre>`,
    })
  }

  logger.info("notification_sent")
  return { ok: true }
}
