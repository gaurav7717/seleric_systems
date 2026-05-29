import pino from "pino"
import { Resend } from "resend"
import { IncomingWebhook } from "@slack/webhook"

const logger = pino({ name: "processor:notifications" })

interface NotificationData {
  actionId: string
  agent: string
  actionType: string
  rationale: string
  expectedOutcome: string
  confidence: number
  riskLevel: string
  signalId: string
  signalType?: string
  entityId?: string
  entityType?: string
  approvalToken: string
  approveUrl: string
  rejectUrl: string
}

const RISK_EMOJI: Record<string, string> = { high: "🔴", medium: "🟡", low: "🟢" }

export async function sendApprovalNotification(data: Record<string, unknown>) {
  const d = data as NotificationData
  const riskEmoji = RISK_EMOJI[d.riskLevel?.toLowerCase()] ?? "⚪"
  const confidencePct = Math.round((d.confidence ?? 0) * 100)

  const slackUrl = process.env.SLACK_WEBHOOK_URL
  if (slackUrl) {
    const webhook = new IncomingWebhook(slackUrl)
    await webhook.send({
      text: `Action pending approval: ${d.actionType} (${d.agent})`,
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: `${riskEmoji} Action Requires Approval` },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Agent:*\n${d.agent}` },
            { type: "mrkdwn", text: `*Action:*\n${d.actionType}` },
            { type: "mrkdwn", text: `*Risk:*\n${riskEmoji} ${d.riskLevel?.toUpperCase()}` },
            { type: "mrkdwn", text: `*Confidence:*\n${confidencePct}%` },
            { type: "mrkdwn", text: `*Signal:*\n${d.signalType ?? d.signalId}` },
            { type: "mrkdwn", text: `*Entity:*\n${d.entityType} / ${d.entityId}` },
          ],
        },
        {
          type: "section",
          text: { type: "mrkdwn", text: `*Rationale:*\n${d.rationale}` },
        },
        {
          type: "section",
          text: { type: "mrkdwn", text: `*Expected Outcome:*\n${d.expectedOutcome}` },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "✅ Approve" },
              style: "primary",
              url: d.approveUrl,
            },
            {
              type: "button",
              text: { type: "plain_text", text: "❌ Reject" },
              style: "danger",
              url: d.rejectUrl,
            },
          ],
        },
      ],
    })
    logger.info({ actionId: d.actionId }, "slack_notification_sent")
  }

  const resendKey = process.env.RESEND_API_KEY
  const to = process.env.NOTIFICATION_EMAIL
  if (resendKey && to) {
    const resend = new Resend(resendKey)
    const from = process.env.NOTIFICATION_FROM ?? "alerts@multiagent.local"
    await resend.emails.send({
      from,
      to,
      subject: `[${riskEmoji} ${d.riskLevel?.toUpperCase()}] Action approval required: ${d.actionType}`,
      html: buildEmailHtml(d, riskEmoji, confidencePct),
    })
    logger.info({ actionId: d.actionId }, "email_notification_sent")
  }

  logger.info({ actionId: d.actionId }, "notification_sent")
  return { ok: true }
}

function buildEmailHtml(d: NotificationData, riskEmoji: string, confidencePct: number): string {
  return `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h2 style="border-bottom: 2px solid #e2e8f0; padding-bottom: 12px;">
    ${riskEmoji} Action Pending Approval
  </h2>
  <table style="width:100%; border-collapse:collapse; margin: 16px 0;">
    <tr><td style="padding:8px; background:#f8fafc; font-weight:bold; width:40%;">Agent</td>
        <td style="padding:8px;">${d.agent}</td></tr>
    <tr><td style="padding:8px; background:#f8fafc; font-weight:bold;">Action</td>
        <td style="padding:8px;">${d.actionType}</td></tr>
    <tr><td style="padding:8px; background:#f8fafc; font-weight:bold;">Risk Level</td>
        <td style="padding:8px;">${riskEmoji} ${d.riskLevel?.toUpperCase()}</td></tr>
    <tr><td style="padding:8px; background:#f8fafc; font-weight:bold;">Confidence</td>
        <td style="padding:8px;">${confidencePct}%</td></tr>
    <tr><td style="padding:8px; background:#f8fafc; font-weight:bold;">Signal</td>
        <td style="padding:8px;">${d.signalType ?? d.signalId}</td></tr>
    <tr><td style="padding:8px; background:#f8fafc; font-weight:bold;">Entity</td>
        <td style="padding:8px;">${d.entityType} / ${d.entityId}</td></tr>
  </table>
  <h3>Rationale</h3>
  <p style="background:#f8fafc; padding:12px; border-radius:6px;">${d.rationale}</p>
  <h3>Expected Outcome</h3>
  <p style="background:#f8fafc; padding:12px; border-radius:6px;">${d.expectedOutcome}</p>
  <div style="margin-top: 24px; display: flex; gap: 12px;">
    <a href="${d.approveUrl}"
       style="background:#16a34a; color:#fff; padding:12px 24px; border-radius:6px; text-decoration:none; font-weight:bold; display:inline-block;">
      Approve
    </a>
    &nbsp;&nbsp;
    <a href="${d.rejectUrl}"
       style="background:#dc2626; color:#fff; padding:12px 24px; border-radius:6px; text-decoration:none; font-weight:bold; display:inline-block;">
      Reject
    </a>
  </div>
  <p style="margin-top:24px; color:#6b7280; font-size:12px;">
    This action will expire if not acted upon. Action ID: ${d.actionId}
  </p>
</body>
</html>`
}
