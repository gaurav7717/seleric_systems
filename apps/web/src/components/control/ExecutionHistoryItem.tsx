"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"

interface OutcomeMeasurement {
  windowHours: number
  outcomeScore: number
  metricDeltas: Record<string, number | null>
  measuredAt: string
}

interface HistoryAction {
  id: string
  agent: string
  actionType: string
  actionPayload: unknown
  rationale: string
  confidence: number
  riskLevel: string
  classification: string
  status: "EXECUTED" | "FAILED"
  executedAt: string | null
  executionResult: { beforeState?: Record<string, unknown>; response?: unknown } | null
  executionError: string | null
  approvedBy: string | null
  signal?: {
    entityType: string
    entityId: string
    signalType: string
    insights?: Array<{ outcomes: OutcomeMeasurement[] }>
  }
}

interface ExecutionHistoryItemProps {
  action: HistoryAction
}

function scoreColor(score: number): string {
  if (score >= 0.3) return "text-green-600 dark:text-green-400"
  if (score <= -0.3) return "text-red-600 dark:text-red-400"
  return "text-stone-500 dark:text-night-400"
}

export function ExecutionHistoryItem({ action }: ExecutionHistoryItemProps) {
  const [expanded, setExpanded] = useState(false)
  const outcomes = action.signal?.insights?.[0]?.outcomes ?? []
  const bestOutcome = outcomes.length > 0 ? outcomes[outcomes.length - 1] : null

  return (
    <div className="rounded-xl border border-stone-200 dark:border-night-800 bg-white dark:bg-night-900 p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              action.status === "EXECUTED"
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            }`}
          >
            {action.status}
          </span>
          <span className="text-xs font-mono bg-stone-100 dark:bg-night-850 px-2 py-0.5 rounded">
            {action.agent}
          </span>
          <span className="font-medium text-stone-900 dark:text-night-50 text-sm">{action.actionType}</span>
        </div>
        <div className="flex items-center gap-3">
          {bestOutcome && (
            <span className={`text-sm font-semibold tabular-nums ${scoreColor(bestOutcome.outcomeScore)}`}>
              score {bestOutcome.outcomeScore > 0 ? "+" : ""}{bestOutcome.outcomeScore.toFixed(2)}
            </span>
          )}
          {action.executedAt && (
            <span className="text-xs text-stone-400 dark:text-night-500 whitespace-nowrap">
              {formatDistanceToNow(new Date(action.executedAt), { addSuffix: true })}
            </span>
          )}
        </div>
      </div>

      {action.signal && (
        <p className="text-xs text-stone-500 dark:text-night-400">
          {action.signal.signalType} &mdash; {action.signal.entityType} {action.signal.entityId}
          {action.approvedBy && <> &mdash; approved by <span className="font-medium">{action.approvedBy}</span></>}
        </p>
      )}

      {action.status === "FAILED" && action.executionError && (
        <p className="text-xs text-red-600 dark:text-red-400 font-mono bg-red-50 dark:bg-red-900/10 rounded p-2">
          {action.executionError}
        </p>
      )}

      {outcomes.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          {outcomes.map((o) => (
            <div key={o.windowHours} className="text-xs">
              <span className="text-stone-400 dark:text-night-500">T+{o.windowHours}h: </span>
              <span className={`font-semibold ${scoreColor(o.outcomeScore)}`}>
                {o.outcomeScore > 0 ? "+" : ""}{o.outcomeScore.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}

      <button
        className="text-xs text-blue-600 dark:text-blue-400 underline underline-offset-2"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? "Hide" : "Show"} details
      </button>

      {expanded && (
        <div className="space-y-2">
          <div>
            <p className="text-xs font-semibold text-stone-400 dark:text-night-500 uppercase tracking-wide mb-1">
              Rationale
            </p>
            <p className="text-xs text-stone-600 dark:text-night-300">{action.rationale}</p>
          </div>
          {action.executionResult?.beforeState && (
            <div>
              <p className="text-xs font-semibold text-stone-400 dark:text-night-500 uppercase tracking-wide mb-1">
                Before State
              </p>
              <pre className="text-xs bg-stone-50 dark:bg-night-850 rounded p-2 overflow-x-auto max-h-32">
                {JSON.stringify(action.executionResult.beforeState, null, 2)}
              </pre>
            </div>
          )}
          {action.executionResult?.response && (
            <div>
              <p className="text-xs font-semibold text-stone-400 dark:text-night-500 uppercase tracking-wide mb-1">
                Execution Response
              </p>
              <pre className="text-xs bg-stone-50 dark:bg-night-850 rounded p-2 overflow-x-auto max-h-32">
                {JSON.stringify(action.executionResult.response, null, 2)}
              </pre>
            </div>
          )}
          {outcomes.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-stone-400 dark:text-night-500 uppercase tracking-wide mb-1">
                Outcome Deltas
              </p>
              {outcomes.map((o) => (
                <div key={o.windowHours} className="text-xs mb-1">
                  <span className="font-medium">T+{o.windowHours}h:</span>{" "}
                  {Object.entries(o.metricDeltas)
                    .filter(([, v]) => v != null)
                    .map(([k, v]) => `${k}: ${v! > 0 ? "+" : ""}${(v! * 100).toFixed(1)}%`)
                    .join(", ")}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
