"use client"

import { useCallback, useState } from "react"
import useSWR from "swr"
import { ApprovalCard } from "@/components/control/ApprovalCard"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function ApprovalsPage() {
  const { data, error, isLoading, mutate } = useSWR("/api/approvals", fetcher, {
    refreshInterval: 30_000,
  })

  const handleActioned = useCallback(
    (id: string) => {
      mutate(
        (prev: unknown[]) => (prev ? prev.filter((a: { id: string }) => a.id !== id) : []),
        { revalidate: false },
      )
    },
    [mutate],
  )

  const actions: unknown[] = data ?? []

  return (
    <main className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-stone-900 dark:text-night-50">Approval Queue</h1>
        {!isLoading && (
          <span className="text-sm text-stone-500 dark:text-night-400">
            {actions.length} pending
          </span>
        )}
      </div>

      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 rounded-xl bg-stone-100 dark:bg-night-850 animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">Failed to load approvals. Retrying…</p>
      )}

      {!isLoading && !error && actions.length === 0 && (
        <div className="rounded-xl border border-dashed border-stone-200 dark:border-night-800 py-16 text-center">
          <p className="text-stone-400 dark:text-night-500 text-sm">No actions pending approval</p>
        </div>
      )}

      <div className="space-y-4">
        {actions.map((action) => (
          <ApprovalCard
            key={(action as { id: string }).id}
            action={action as Parameters<typeof ApprovalCard>[0]["action"]}
            onActioned={handleActioned}
          />
        ))}
      </div>
    </main>
  )
}
