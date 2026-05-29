"use client"

import { useCallback, useState } from "react"
import useSWR from "swr"
import { formatDistanceToNow } from "date-fns"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  WARNING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  INFO: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
}

const SEVERITY_DOT: Record<string, string> = {
  CRITICAL: "bg-red-500",
  WARNING: "bg-amber-400",
  INFO: "bg-green-500",
}

type Severity = "CRITICAL" | "WARNING" | "INFO"

interface InsightRow {
  id: string
  severity: Severity
  title: string
  what: string
  why: string
  evidence: string[]
  confidence: number
  agent: string
  createdAt: string
  signal?: { entityType: string; entityId: string; signalType: string; firedAt: string }
}

interface InsightCardProps {
  insight: InsightRow
  onActioned: (id: string) => void
}

function InsightCard({ insight, onActioned }: InsightCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [acting, setActing] = useState(false)
  const [snoozeOpen, setSnoozeOpen] = useState(false)
  const confidencePct = Math.round(insight.confidence * 100)
  const age = formatDistanceToNow(new Date(insight.createdAt), { addSuffix: true })

  async function handleAction(action: "dismiss" | "snooze", snoozeDuration?: 1 | 4 | 24) {
    setActing(true)
    setSnoozeOpen(false)
    try {
      await fetch(`/api/insights/${insight.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, snoozeDuration }),
      })
      onActioned(insight.id)
    } finally {
      setActing(false)
    }
  }

  return (
    <div className="rounded-xl border border-stone-200 dark:border-night-800 bg-white dark:bg-night-900 p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${SEVERITY_COLOR[insight.severity]}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${SEVERITY_DOT[insight.severity]}`} />
            {insight.severity}
          </span>
          <span className="text-xs font-mono bg-stone-100 dark:bg-night-850 px-2 py-0.5 rounded text-stone-500 dark:text-night-400">
            {insight.agent}
          </span>
        </div>
        <span className="text-xs text-stone-400 dark:text-night-500 whitespace-nowrap">{age}</span>
      </div>

      <h3 className="font-semibold text-stone-900 dark:text-night-50 text-sm leading-snug">
        {insight.title}
      </h3>

      {insight.signal && (
        <p className="text-xs text-stone-500 dark:text-night-400">
          {insight.signal.signalType} &mdash; {insight.signal.entityType} {insight.signal.entityId}
        </p>
      )}

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-stone-400 dark:text-night-500">
          <span>Confidence</span><span>{confidencePct}%</span>
        </div>
        <div className="h-1 w-full rounded-full bg-stone-100 dark:bg-night-800">
          <div className="h-1 rounded-full bg-blue-500" style={{ width: `${confidencePct}%` }} />
        </div>
      </div>

      <button
        className="text-xs text-blue-600 dark:text-blue-400 underline underline-offset-2"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? "Collapse" : "Expand"}
      </button>

      {expanded && (
        <div className="space-y-3 pt-1">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-night-500 mb-1">What</p>
            <p className="text-sm text-stone-700 dark:text-night-200">{insight.what}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-night-500 mb-1">Why</p>
            <p className="text-sm text-stone-700 dark:text-night-200">{insight.why}</p>
          </div>
          {Array.isArray(insight.evidence) && insight.evidence.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-night-500 mb-1">Evidence</p>
              <ul className="space-y-0.5">
                {insight.evidence.map((e, i) => (
                  <li key={i} className="text-xs text-stone-600 dark:text-night-300 flex gap-2">
                    <span className="text-stone-300 dark:text-night-600">•</span>{e}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 pt-1 border-t border-stone-100 dark:border-night-800">
        <button
          onClick={() => handleAction("dismiss")}
          disabled={acting}
          className="text-xs text-stone-500 dark:text-night-400 hover:text-stone-700 dark:hover:text-night-200 transition-colors disabled:opacity-40"
        >
          Dismiss
        </button>
        <div className="relative">
          <button
            onClick={() => setSnoozeOpen((v) => !v)}
            disabled={acting}
            className="text-xs text-stone-500 dark:text-night-400 hover:text-stone-700 dark:hover:text-night-200 transition-colors disabled:opacity-40"
          >
            Snooze ▾
          </button>
          {snoozeOpen && (
            <div className="absolute left-0 top-5 z-10 bg-white dark:bg-night-900 border border-stone-200 dark:border-night-800 rounded-lg shadow-md p-1 flex flex-col gap-0.5 min-w-[80px]">
              {([1, 4, 24] as const).map((h) => (
                <button
                  key={h}
                  onClick={() => handleAction("snooze", h)}
                  className="text-xs px-3 py-1.5 text-left hover:bg-stone-50 dark:hover:bg-night-850 rounded text-stone-700 dark:text-night-200"
                >
                  {h}h
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const FILTERS: { label: string; value: string }[] = [
  { label: "All", value: "" },
  { label: "Critical", value: "CRITICAL" },
  { label: "Warning", value: "WARNING" },
  { label: "Info", value: "INFO" },
]

export default function InsightsPage() {
  const [filter, setFilter] = useState("")
  const url = `/api/insights?limit=50${filter ? `&severity=${filter}` : ""}`
  const { data, error, isLoading, mutate } = useSWR(url, fetcher, { refreshInterval: 30_000 })

  const insights: InsightRow[] = data ?? []

  const handleActioned = useCallback(
    (id: string) => {
      mutate(
        (prev: InsightRow[]) => (prev ? prev.filter((i) => i.id !== id) : []),
        { revalidate: false },
      )
    },
    [mutate],
  )

  return (
    <main className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold text-stone-900 dark:text-night-50">Insights</h1>
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filter === f.value
                  ? "bg-stone-900 dark:bg-night-100 text-white dark:text-night-900"
                  : "bg-stone-100 dark:bg-night-850 text-stone-600 dark:text-night-300 hover:bg-stone-200 dark:hover:bg-night-800"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-stone-100 dark:bg-night-850 animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">Failed to load insights. Retrying…</p>
      )}

      {!isLoading && !error && insights.length === 0 && (
        <div className="rounded-xl border border-dashed border-stone-200 dark:border-night-800 py-20 text-center space-y-2">
          <p className="text-stone-400 dark:text-night-500 text-sm">No insights yet</p>
          <p className="text-stone-300 dark:text-night-600 text-xs">
            Fire a signal to the orchestrator at POST /signal to generate insights
          </p>
        </div>
      )}

      <div className="space-y-4">
        {insights.map((insight) => (
          <InsightCard key={insight.id} insight={insight} onActioned={handleActioned} />
        ))}
      </div>
    </main>
  )
}
