"use client"

import useSWR from "swr"
import { ExecutionHistoryItem } from "@/components/control/ExecutionHistoryItem"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function HistoryPage() {
  const { data, error, isLoading } = useSWR("/api/actions/history", fetcher, {
    refreshInterval: 60_000,
  })

  const actions: unknown[] = data ?? []

  return (
    <main className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-stone-900 dark:text-night-50">Execution History</h1>
        {!isLoading && (
          <span className="text-sm text-stone-500 dark:text-night-400">
            {actions.length} actions
          </span>
        )}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-stone-100 dark:bg-night-850 animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">Failed to load history. Retrying…</p>
      )}

      {!isLoading && !error && actions.length === 0 && (
        <div className="rounded-xl border border-dashed border-stone-200 dark:border-night-800 py-16 text-center">
          <p className="text-stone-400 dark:text-night-500 text-sm">No executed actions yet</p>
        </div>
      )}

      <div className="space-y-3">
        {actions.map((action) => (
          <ExecutionHistoryItem
            key={(action as { id: string }).id}
            action={action as Parameters<typeof ExecutionHistoryItem>[0]["action"]}
          />
        ))}
      </div>
    </main>
  )
}
