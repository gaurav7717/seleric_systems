"use client"

import Link from "next/link"
import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface PendingAction {
  id: string
}

interface CriticalInsight {
  id: string
  title: string
}

interface ExecutedAction {
  id: string
  agent: string
  actionType: string
  executedAt: string | null
  signal?: {
    insights?: Array<{
      outcomes: Array<{ outcomeScore: number }>
    }>
  }
}

function scoreColor(score: number): string {
  if (score >= 0.3) return "text-green-600 dark:text-green-400"
  if (score <= -0.3) return "text-red-600 dark:text-red-400"
  return "text-stone-400 dark:text-night-500"
}

export function AgentActivityPanel() {
  const { data: pending } = useSWR<PendingAction[]>("/api/approvals", fetcher, {
    refreshInterval: 30_000,
  })
  const { data: criticalInsights } = useSWR<CriticalInsight[]>(
    "/api/insights?severity=CRITICAL&limit=1",
    fetcher,
    { refreshInterval: 30_000 },
  )
  const { data: history } = useSWR<ExecutedAction[]>("/api/actions/history", fetcher, {
    refreshInterval: 30_000,
  })

  const pendingCount = pending?.length ?? 0
  const latestCritical = criticalInsights?.[0] ?? null
  const recentExecuted = (history ?? []).slice(0, 3)

  return (
    <div className="rounded-xl border border-stone-200 dark:border-night-800 bg-white dark:bg-night-900 px-5 py-4 flex flex-wrap gap-6 items-start">
      <div className="min-w-[140px]">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-night-500 mb-1">
          Agent Queue
        </p>
        {pendingCount > 0 ? (
          <Link
            href="/control/approvals"
            className="text-sm font-semibold text-amber-600 dark:text-amber-400 hover:underline"
          >
            {pendingCount} pending approval{pendingCount !== 1 ? "s" : ""} →
          </Link>
        ) : (
          <p className="text-sm text-green-600 dark:text-green-400 font-semibold">All clear</p>
        )}
      </div>

      <div className="min-w-[200px] flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-night-500 mb-1">
          Latest Critical Insight
        </p>
        {latestCritical ? (
          <Link
            href="/insights"
            className="text-sm font-semibold text-red-600 dark:text-red-400 hover:underline line-clamp-2 leading-snug block"
          >
            {latestCritical.title} →
          </Link>
        ) : (
          <p className="text-sm text-stone-400 dark:text-night-500">No critical insights</p>
        )}
      </div>

      {recentExecuted.length > 0 && (
        <div className="min-w-[220px]">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-night-500 mb-1">
            Recent Actions
          </p>
          <div className="space-y-1">
            {recentExecuted.map((a) => {
              const outcomes = a.signal?.insights?.[0]?.outcomes ?? []
              const best = outcomes[outcomes.length - 1]
              return (
                <div key={a.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-stone-600 dark:text-night-300 truncate">
                    <span className="font-mono text-stone-400 dark:text-night-500">{a.agent}</span>
                    {" "}
                    {a.actionType}
                  </span>
                  {best && (
                    <span
                      className={`font-semibold tabular-nums shrink-0 ${scoreColor(best.outcomeScore)}`}
                    >
                      {best.outcomeScore > 0 ? "+" : ""}
                      {best.outcomeScore.toFixed(2)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
