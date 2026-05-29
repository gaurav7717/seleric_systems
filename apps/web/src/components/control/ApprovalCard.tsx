"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"

interface PendingAction {
  id: string
  agent: string
  actionType: string
  actionPayload: unknown
  rationale: string
  expectedOutcome: string
  confidence: number
  riskLevel: "LOW" | "MEDIUM" | "HIGH"
  expiresAt: string
  signalId: string
  signal?: { entityType: string; entityId: string; signalType: string }
}

interface ApprovalCardProps {
  action: PendingAction
  onActioned: (id: string) => void
}

const RISK_COLOR: Record<string, string> = {
  HIGH: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  MEDIUM: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  LOW: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
}

export function ApprovalCard({ action, onActioned }: ApprovalCardProps) {
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null)
  const [showReject, setShowReject] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [showPayload, setShowPayload] = useState(false)

  const expiresIn = formatDistanceToNow(new Date(action.expiresAt), { addSuffix: true })
  const confidencePct = Math.round(action.confidence * 100)

  async function handleDecision(decision: "approved" | "rejected") {
    setLoading(decision === "approved" ? "approve" : "reject")
    try {
      const res = await fetch(`/api/approvals/${action.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          rejectedReason: decision === "rejected" ? rejectReason : undefined,
        }),
      })
      if (res.ok) {
        onActioned(action.id)
      }
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="rounded-xl border border-stone-200 dark:border-night-800 bg-white dark:bg-night-900 p-5 space-y-4 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono bg-stone-100 dark:bg-night-850 px-2 py-0.5 rounded">
            {action.agent}
          </span>
          <span className="font-semibold text-stone-900 dark:text-night-50">{action.actionType}</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${RISK_COLOR[action.riskLevel] ?? RISK_COLOR.MEDIUM}`}>
            {action.riskLevel}
          </span>
        </div>
        <span className="text-xs text-stone-400 dark:text-night-500 whitespace-nowrap">expires {expiresIn}</span>
      </div>

      {/* Signal context */}
      {action.signal && (
        <p className="text-xs text-stone-500 dark:text-night-400">
          Signal: <span className="font-medium">{action.signal.signalType}</span> &mdash;{" "}
          {action.signal.entityType} {action.signal.entityId}
        </p>
      )}

      {/* Confidence bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-stone-500 dark:text-night-400">
          <span>Confidence</span>
          <span>{confidencePct}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-stone-100 dark:bg-night-800">
          <div
            className="h-1.5 rounded-full bg-blue-500"
            style={{ width: `${confidencePct}%` }}
          />
        </div>
      </div>

      {/* Rationale */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-night-500 mb-1">
          Rationale
        </p>
        <p className="text-sm text-stone-700 dark:text-night-200">{action.rationale}</p>
      </div>

      {/* Expected outcome */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-night-500 mb-1">
          Expected Outcome
        </p>
        <p className="text-sm text-stone-700 dark:text-night-200">{action.expectedOutcome}</p>
      </div>

      {/* Payload toggle */}
      <button
        className="text-xs text-blue-600 dark:text-blue-400 underline underline-offset-2"
        onClick={() => setShowPayload((v) => !v)}
      >
        {showPayload ? "Hide" : "Show"} action payload
      </button>
      {showPayload && (
        <pre className="text-xs bg-stone-50 dark:bg-night-850 rounded p-3 overflow-x-auto max-h-40">
          {JSON.stringify(action.actionPayload, null, 2)}
        </pre>
      )}

      {/* Reject reason input */}
      {showReject && (
        <div className="space-y-2">
          <textarea
            className="w-full rounded-lg border border-stone-200 dark:border-night-700 bg-white dark:bg-night-850 px-3 py-2 text-sm text-stone-800 dark:text-night-100 resize-none"
            rows={2}
            placeholder="Reason for rejection (optional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              className="flex-1 rounded-lg bg-red-600 text-white text-sm font-semibold py-2 disabled:opacity-50"
              disabled={loading === "reject"}
              onClick={() => handleDecision("rejected")}
            >
              {loading === "reject" ? "Rejecting…" : "Confirm Reject"}
            </button>
            <button
              className="rounded-lg border border-stone-200 dark:border-night-700 px-3 py-2 text-sm"
              onClick={() => setShowReject(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {!showReject && (
        <div className="flex gap-3 pt-1">
          <button
            className="flex-1 rounded-lg bg-green-600 text-white text-sm font-semibold py-2 disabled:opacity-50 hover:bg-green-700 transition-colors"
            disabled={loading === "approve"}
            onClick={() => handleDecision("approved")}
          >
            {loading === "approve" ? "Approving…" : "Approve"}
          </button>
          <button
            className="flex-1 rounded-lg border border-stone-200 dark:border-night-700 text-stone-700 dark:text-night-200 text-sm font-semibold py-2 hover:bg-stone-50 dark:hover:bg-night-850 transition-colors"
            onClick={() => setShowReject(true)}
          >
            Reject
          </button>
        </div>
      )}
    </div>
  )
}
